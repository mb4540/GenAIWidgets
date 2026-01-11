import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';
import mammoth from 'mammoth';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const SOURCE_STORE_NAME = 'user-files';
const OUTPUT_STORE_NAME = 'extracted-chunks';
const SCHEMA_VERSION = '1.0';

interface ExtractionJobRow {
  job_id: string;
  blob_id: string;
  extraction_version: string;
  model_version: string | null;
  status: string;
  correlation_id: string | null;
}

interface BlobInventoryRow {
  blob_id: string;
  tenant_id: string;
  source_store: string;
  blob_key: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  byte_hash_sha256: string | null;
}

interface ChunkRecord {
  schemaVersion: string;
  extractionVersion: string;
  documentId: string;
  chunkId: string;
  source: {
    sourceUri: string;
    fileName: string;
    mimeType: string | null;
    sizeBytes: number | null;
    byteHashSha256: string | null;
  };
  provenance: {
    pageStart: number | null;
    pageEnd: number | null;
    sectionPath: string[];
    contentOffsetStart: number;
    contentOffsetEnd: number;
  };
  content: {
    title: string | null;
    chunkText: string;
    searchText: string;
    language: string;
  };
  quality: {
    confidence: number;
    warnings: string[];
  };
  timestamps: {
    extractedAt: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface ExtractedContent {
  title?: string;
  language?: string;
  pages?: Array<{
    pageNumber: number;
    text: string;
    headings?: string[];
  }>;
  fullText?: string;
}

interface PromptConfig {
  modelProvider: string;
  modelName: string;
  systemPrompt: string | null;
  userPromptTemplate: string;
  temperature: number;
  maxTokens: number;
}

interface PromptRow {
  model_provider: string;
  model_name: string;
  system_prompt: string | null;
  user_prompt_template: string;
  temperature: string;
  max_tokens: number;
}

async function getPromptConfig(functionName: string): Promise<PromptConfig> {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not configured');
  }

  const sql = neon(DATABASE_URL);
  const result = await sql`
    SELECT model_provider, model_name, system_prompt, user_prompt_template, temperature, max_tokens
    FROM prompts 
    WHERE function_name = ${functionName} AND is_active = true
  ` as PromptRow[];

  if (!result[0]) {
    throw new Error(`No active prompt found for function: ${functionName}`);
  }

  const row = result[0];
  return {
    modelProvider: row.model_provider,
    modelName: row.model_name,
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template,
    temperature: parseFloat(row.temperature),
    maxTokens: row.max_tokens,
  };
}

/**
 * Convert Word document to PDF for consistent LLM processing
 * Pattern from AI-EssayGrader reference implementation
 */
async function convertWordToPdf(fileBuffer: Buffer): Promise<Buffer> {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  const extractedText = result.value;

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('No text could be extracted from the Word document');
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const margin = 50;
  const lineHeight = fontSize * 1.2;

  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  let yPosition = height - margin;

  const maxWidth = width - 2 * margin;
  const words = extractedText.split(/\s+/);
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const textWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (textWidth > maxWidth && currentLine) {
      page.drawText(currentLine, {
        x: margin,
        y: yPosition,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= lineHeight;
      currentLine = word;

      if (yPosition < margin) {
        page = pdfDoc.addPage();
        yPosition = height - margin;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    page.drawText(currentLine, {
      x: margin,
      y: yPosition,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Determine if file is a Word document based on mime type or extension
 */
function isWordDocument(mimeType: string | null, fileName: string): boolean {
  if (mimeType?.includes('wordprocessingml') || mimeType?.includes('msword')) {
    return true;
  }
  const lowerName = fileName.toLowerCase();
  return lowerName.endsWith('.docx') || lowerName.endsWith('.doc');
}

/**
 * Determine if file is a PDF
 */
function isPdfDocument(mimeType: string | null, fileName: string): boolean {
  if (mimeType?.includes('pdf')) {
    return true;
  }
  return fileName.toLowerCase().endsWith('.pdf');
}

async function extractWithGemini(
  fileContent: ArrayBuffer,
  fileName: string,
  mimeType: string | null,
  promptConfig: PromptConfig
): Promise<ExtractedContent> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_BASE_URL = process.env.GOOGLE_GEMINI_BASE_URL;
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured - ensure Netlify AI Gateway is enabled');
  }

  let processedContent: Buffer;
  let processMimeType: string;

  // Convert Word documents to PDF for consistent processing
  if (isWordDocument(mimeType, fileName)) {
    console.log(`Converting Word document to PDF: ${fileName}`);
    processedContent = await convertWordToPdf(Buffer.from(fileContent));
    processMimeType = 'application/pdf';
    console.log(`Word→PDF conversion complete: ${processedContent.length} bytes`);
  } else if (isPdfDocument(mimeType, fileName)) {
    processedContent = Buffer.from(fileContent);
    processMimeType = 'application/pdf';
  } else {
    // For other file types, send as-is
    processedContent = Buffer.from(fileContent);
    processMimeType = mimeType || 'application/octet-stream';
  }

  const base64Content = processedContent.toString('base64');

  const baseUrl = GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  const apiUrl = `${baseUrl}/v1beta/models/${promptConfig.modelName}:generateContent`;

  console.log(`Calling Gemini API: model=${promptConfig.modelName}, contentSize=${base64Content.length}`);
  console.log(`Using base URL: ${baseUrl}`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: promptConfig.userPromptTemplate },
          {
            inline_data: {
              mime_type: processMimeType,
              data: base64Content,
            },
          },
        ],
      }],
      generationConfig: {
        temperature: promptConfig.temperature,
        maxOutputTokens: promptConfig.maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error via Netlify AI Gateway: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as GeminiResponse;
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('No content returned from Gemini');
  }

  console.log(`Gemini response received: ${textContent.length} chars`);

  // Try to parse as JSON first (since we requested JSON mode)
  try {
    return JSON.parse(textContent) as ExtractedContent;
  } catch {
    // Fallback: try to extract JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as ExtractedContent;
      } catch {
        // Fall through to plain text handling
      }
    }
    
    // Last resort: treat as plain text
    console.warn('Could not parse JSON from Gemini response, using as plain text');
    return {
      title: fileName,
      language: 'en',
      fullText: textContent,
    };
  }
}

function chunkText(text: string, chunkSize = 1000, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length - overlap) break;
  }

  return chunks;
}

function createChunkRecords(
  extracted: ExtractedContent,
  blob: BlobInventoryRow,
  extractionVersion: string
): ChunkRecord[] {
  const documentId = blob.blob_id;
  const chunks: ChunkRecord[] = [];
  const extractedAt = new Date().toISOString();

  if (extracted.pages && extracted.pages.length > 0) {
    let chunkIndex = 0;
    for (const page of extracted.pages) {
      const pageChunks = chunkText(page.text);
      let offset = 0;

      for (const chunkText of pageChunks) {
        const sectionPath = page.headings || [];
        const searchText = [
          extracted.title || blob.file_name,
          ...sectionPath,
          chunkText,
        ].join('\n');

        chunks.push({
          schemaVersion: SCHEMA_VERSION,
          extractionVersion,
          documentId,
          chunkId: `${documentId}:${String(chunkIndex).padStart(6, '0')}`,
          source: {
            sourceUri: `blob://${blob.source_store}/${blob.blob_key}`,
            fileName: blob.file_name,
            mimeType: blob.mime_type,
            sizeBytes: blob.size_bytes,
            byteHashSha256: blob.byte_hash_sha256,
          },
          provenance: {
            pageStart: page.pageNumber,
            pageEnd: page.pageNumber,
            sectionPath,
            contentOffsetStart: offset,
            contentOffsetEnd: offset + chunkText.length,
          },
          content: {
            title: extracted.title || null,
            chunkText,
            searchText,
            language: extracted.language || 'en',
          },
          quality: {
            confidence: 0.9,
            warnings: [],
          },
          timestamps: {
            extractedAt,
          },
        });

        offset += chunkText.length;
        chunkIndex++;
      }
    }
  } else if (extracted.fullText) {
    const textChunks = chunkText(extracted.fullText);
    let offset = 0;

    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      if (!chunk) continue;
      
      const searchText = [
        extracted.title || blob.file_name,
        chunk,
      ].join('\n');

      chunks.push({
        schemaVersion: SCHEMA_VERSION,
        extractionVersion,
        documentId,
        chunkId: `${documentId}:${String(i).padStart(6, '0')}`,
        source: {
          sourceUri: `blob://${blob.source_store}/${blob.blob_key}`,
          fileName: blob.file_name,
          mimeType: blob.mime_type,
          sizeBytes: blob.size_bytes,
          byteHashSha256: blob.byte_hash_sha256,
        },
        provenance: {
          pageStart: null,
          pageEnd: null,
          sectionPath: [],
          contentOffsetStart: offset,
          contentOffsetEnd: offset + chunk.length,
        },
        content: {
          title: extracted.title || null,
          chunkText: chunk,
          searchText,
          language: extracted.language || 'en',
        },
        quality: {
          confidence: 0.9,
          warnings: [],
        },
        timestamps: {
          extractedAt,
        },
      });

      offset += chunk.length;
    }
  }

  return chunks;
}

async function processExtraction(jobId: string | undefined, processNext: boolean | undefined): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not configured');
    return;
  }

  const sql = neon(DATABASE_URL);
  let currentJobId: string | undefined;

  try {
    let job: ExtractionJobRow | undefined;

    if (jobId) {
      const jobs = await sql`
        SELECT * FROM extraction_jobs WHERE job_id = ${jobId} AND status = 'queued'
      ` as ExtractionJobRow[];
      job = jobs[0];
    } else if (processNext) {
      const jobs = await sql`
        SELECT * FROM extraction_jobs 
        WHERE status = 'queued'
        ORDER BY queued_at ASC
        LIMIT 1
      ` as ExtractionJobRow[];
      job = jobs[0];
    }

    if (!job) {
      console.log('No jobs to process');
      return;
    }

    // Track the job we're processing for error handling
    currentJobId = job.job_id;
    const startTime = Date.now();
    console.log(`Starting extraction job: ${currentJobId}`);
    console.log(`Job details: blob_id=${job.blob_id}, version=${job.extraction_version}`);

    await sql`
      UPDATE extraction_jobs 
      SET status = 'running', started_at = NOW()
      WHERE job_id = ${job.job_id}
    `;

    const blobs = await sql`
      SELECT * FROM blob_inventory WHERE blob_id = ${job.blob_id}
    ` as BlobInventoryRow[];

    const blob = blobs[0];
    if (!blob) {
      console.error(`Blob not found in inventory: ${job.blob_id}`);
      await sql`
        UPDATE extraction_jobs 
        SET status = 'failed', error_message = 'Blob not found in inventory'
        WHERE job_id = ${job.job_id}
      `;
      return;
    }

    console.log(`Found blob: ${blob.file_name}, key=${blob.blob_key}, store=${blob.source_store}`);

    const sourceStore = getStore(SOURCE_STORE_NAME);
    console.log(`Getting file from blob store: ${SOURCE_STORE_NAME}/${blob.blob_key}`);
    const fileBlob = await sourceStore.get(blob.blob_key, { type: 'arrayBuffer' });

    if (!fileBlob) {
      console.error(`File not found in blob store: ${SOURCE_STORE_NAME}/${blob.blob_key}`);
      await sql`
        UPDATE extraction_jobs 
        SET status = 'failed', error_message = 'File not found in blob store'
        WHERE job_id = ${job.job_id}
      `;
      await sql`
        UPDATE blob_inventory SET status = 'failed' WHERE blob_id = ${blob.blob_id}
      `;
      return;
    }

    const promptConfig = await getPromptConfig('extraction');
    const extracted = await extractWithGemini(fileBlob, blob.file_name, blob.mime_type, promptConfig);
    const chunks = createChunkRecords(extracted, blob, job.extraction_version);

    const jsonlContent = chunks.map(c => JSON.stringify(c)).join('\n');
    const outputBlobKey = `${blob.blob_id}/${uuid()}.jsonl`;

    const outputStore = getStore(OUTPUT_STORE_NAME);
    await outputStore.set(outputBlobKey, jsonlContent, {
      metadata: {
        documentId: blob.blob_id,
        chunkCount: String(chunks.length),
        extractionVersion: job.extraction_version,
      },
    });

    const contentHash = createHash('sha256').update(jsonlContent).digest('hex');
    const processingTime = Date.now() - startTime;

    await sql`
      INSERT INTO extraction_outputs (job_id, blob_id, output_store, output_blob_key, output_type, chunk_count, size_bytes, content_hash_sha256, schema_version)
      VALUES (${job.job_id}, ${blob.blob_id}, ${OUTPUT_STORE_NAME}, ${outputBlobKey}, 'chunk_jsonl', ${chunks.length}, ${jsonlContent.length}, ${contentHash}, ${SCHEMA_VERSION})
    `;

    await sql`
      UPDATE extraction_jobs 
      SET status = 'completed', completed_at = NOW(), processing_time_ms = ${processingTime}, chunk_count = ${chunks.length}
      WHERE job_id = ${job.job_id}
    `;

    await sql`
      UPDATE blob_inventory SET status = 'extracted' WHERE blob_id = ${blob.blob_id}
    `;

    console.log(`Extraction completed: ${job.job_id}, ${chunks.length} chunks, ${processingTime}ms`);
  } catch (error) {
    console.error('Error in extraction processing:', error);
    
    // Use currentJobId (which tracks the actual job being processed) instead of just jobId
    const failedJobId = currentJobId || jobId;
    if (failedJobId) {
      try {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Marking job ${failedJobId} as failed: ${errorMessage}`);
        
        await sql`
          UPDATE extraction_jobs 
          SET status = 'failed', error_message = ${errorMessage}
          WHERE job_id = ${failedJobId}
        `;
        
        // Also update blob_inventory status to failed
        const jobInfo = await sql`
          SELECT blob_id FROM extraction_jobs WHERE job_id = ${failedJobId}
        ` as { blob_id: string }[];
        
        if (jobInfo[0]) {
          await sql`
            UPDATE blob_inventory SET status = 'failed' WHERE blob_id = ${jobInfo[0].blob_id}
          `;
        }
      } catch (updateError) {
        console.error('Failed to update job status:', updateError);
      }
    }
  }
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return createErrorResponse(authResult.error, authResult.status);
  }

  const { context } = authResult;
  
  if (!context.isAdmin) {
    return createErrorResponse('Admin access required', 403);
  }

  try {
    const body = await req.json() as { jobId?: string; processNext?: boolean };
    const { jobId, processNext } = body;

    // In serverless, we must await the processing - fire-and-forget doesn't work
    // The function will be kept alive until processing completes
    await processExtraction(jobId, processNext);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Extraction completed',
        jobId: jobId || 'next-queued'
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in extraction-worker-background:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
