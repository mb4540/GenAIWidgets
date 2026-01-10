import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

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

async function extractWithGemini(
  fileContent: ArrayBuffer,
  fileName: string,
  mimeType: string | null
): Promise<ExtractedContent> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const base64Content = Buffer.from(fileContent).toString('base64');
  
  const prompt = `Extract the text content from this document. Return a JSON object with:
- title: the document title if identifiable
- language: the primary language code (e.g., "en", "es", "fr")
- pages: an array of page objects, each with:
  - pageNumber: the page number (1-indexed)
  - text: the extracted text for that page
  - headings: any section headings found on that page

If the document doesn't have clear pages (like a text file), return a single page with pageNumber 1.

Return ONLY valid JSON, no markdown formatting or explanation.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-05-06:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType || 'application/octet-stream',
                data: base64Content,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as GeminiResponse;
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('No content returned from Gemini');
  }

  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      title: fileName,
      language: 'en',
      fullText: textContent,
    };
  }

  try {
    return JSON.parse(jsonMatch[0]) as ExtractedContent;
  } catch {
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

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  try {
    const body = await req.json() as { jobId?: string; processNext?: boolean };
    const { jobId, processNext } = body;

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
      return createSuccessResponse({ message: 'No jobs to process' });
    }

    const startTime = Date.now();

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
      await sql`
        UPDATE extraction_jobs 
        SET status = 'failed', error_message = 'Blob not found in inventory'
        WHERE job_id = ${job.job_id}
      `;
      return createErrorResponse('Blob not found', 404);
    }

    const sourceStore = getStore(SOURCE_STORE_NAME);
    const fileBlob = await sourceStore.get(blob.blob_key, { type: 'arrayBuffer' });

    if (!fileBlob) {
      await sql`
        UPDATE extraction_jobs 
        SET status = 'failed', error_message = 'File not found in blob store'
        WHERE job_id = ${job.job_id}
      `;
      await sql`
        UPDATE blob_inventory SET status = 'failed' WHERE blob_id = ${blob.blob_id}
      `;
      return createErrorResponse('File not found in blob store', 404);
    }

    const extracted = await extractWithGemini(fileBlob, blob.file_name, blob.mime_type);
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

    return createSuccessResponse({
      jobId: job.job_id,
      blobId: blob.blob_id,
      fileName: blob.file_name,
      chunkCount: chunks.length,
      processingTimeMs: processingTime,
      outputBlobKey,
    });
  } catch (error) {
    console.error('Error in extraction-worker:', error);
    
    const body = await req.clone().json().catch(() => ({})) as { jobId?: string };
    if (body.jobId) {
      const sql = neon(DATABASE_URL);
      await sql`
        UPDATE extraction_jobs 
        SET status = 'failed', error_message = ${error instanceof Error ? error.message : 'Unknown error'}
        WHERE job_id = ${body.jobId}
      `;
    }

    return createErrorResponse('Internal server error', 500);
  }
}
