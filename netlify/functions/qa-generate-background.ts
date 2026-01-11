import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

const OUTPUT_STORE_NAME = 'extracted-chunks';

interface GenerateRequest {
  blobId?: string;
  fileId?: string;
  questionsPerChunk?: number;
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

interface ChunkRecord {
  content: {
    title: string | null;
    chunkText: string;
  };
  provenance: {
    sectionPath: string[];
  };
}

interface QAPair {
  question: string;
  answer: string;
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

async function generateQAForChunk(
  chunk: ChunkRecord,
  chunkIndex: number,
  questionsPerChunk: number,
  documentTitle: string,
  promptConfig: PromptConfig
): Promise<QAPair[]> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_BASE_URL = process.env.GOOGLE_GEMINI_BASE_URL;

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const sectionPath = chunk.provenance?.sectionPath?.join(' > ') || '';
  
  const userPrompt = promptConfig.userPromptTemplate
    .replace('{{questionsPerChunk}}', String(questionsPerChunk))
    .replace('{{documentTitle}}', documentTitle || 'Unknown')
    .replace('{{sectionPath}}', sectionPath || 'N/A')
    .replace('{{chunkText}}', chunk.content.chunkText);

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: promptConfig.systemPrompt
      ? { parts: [{ text: promptConfig.systemPrompt }] }
      : undefined,
    generationConfig: {
      temperature: promptConfig.temperature,
      maxOutputTokens: promptConfig.maxTokens,
    },
  };

  const baseUrl = GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  const url = `${baseUrl}/v1beta/models/${promptConfig.modelName}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini API error for chunk ${chunkIndex}:`, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON from response
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error(`Failed to parse JSON from chunk ${chunkIndex} response:`, responseText);
    return [];
  }

  try {
    const qaPairs = JSON.parse(jsonMatch[0]) as QAPair[];
    return qaPairs.filter(qa => qa.question && qa.answer);
  } catch (parseError) {
    console.error(`JSON parse error for chunk ${chunkIndex}:`, parseError);
    return [];
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

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return createErrorResponse('Invalid JSON body', 400);
  }

  const { blobId: blobIdParam, fileId, questionsPerChunk = 3 } = body;

  if (!blobIdParam && !fileId) {
    return createErrorResponse('blobId or fileId is required', 400);
  }

  if (questionsPerChunk < 1 || questionsPerChunk > 10) {
    return createErrorResponse('questionsPerChunk must be between 1 and 10', 400);
  }

  try {
    let blobId = blobIdParam;
    let tenantId = context.tenantId;

    // If fileId is provided, look up the blob_id
    if (fileId && !blobId) {
      const fileResult = await sql`
        SELECT bi.blob_id, f.tenant_id
        FROM files f
        JOIN blob_inventory bi ON f.blob_key = bi.blob_key
        WHERE f.file_id = ${fileId}
      ` as { blob_id: string; tenant_id: string }[];

      if (!fileResult[0]) {
        return createErrorResponse('File not found or not extracted', 404);
      }
      blobId = fileResult[0].blob_id;
      tenantId = fileResult[0].tenant_id;
    }

    // Verify tenant access
    if (!context.isAdmin && tenantId !== context.tenantId) {
      return createErrorResponse('Forbidden', 403);
    }

    // Get the extraction output for this blob
    const outputs = await sql`
      SELECT eo.output_blob_key, eo.chunk_count
      FROM extraction_outputs eo
      JOIN extraction_jobs ej ON eo.job_id = ej.job_id
      WHERE eo.blob_id = ${blobId}
      ORDER BY ej.completed_at DESC
      LIMIT 1
    ` as { output_blob_key: string; chunk_count: number }[];

    if (!outputs[0]) {
      return createErrorResponse('No extraction output found for this blob', 404);
    }

    const { output_blob_key, chunk_count } = outputs[0];

    // Fetch chunks from blob store
    const outputStore = getStore(OUTPUT_STORE_NAME);
    const jsonlContent = await outputStore.get(output_blob_key, { type: 'text' });

    if (!jsonlContent) {
      return createErrorResponse('Extraction content not found', 404);
    }

    const chunks: ChunkRecord[] = jsonlContent
      .split('\n')
      .filter((line: string) => line.trim())
      .map((line: string) => JSON.parse(line) as ChunkRecord);

    console.log(`Parsed ${chunks.length} chunks from JSONL content`);

    if (chunks.length === 0) {
      return createErrorResponse('No chunks found in extraction output', 400);
    }

    // Create Q&A generation job
    const jobResult = await sql`
      INSERT INTO qa_generation_jobs (blob_id, tenant_id, questions_per_chunk, total_chunks, status, created_by)
      VALUES (${blobId}, ${tenantId}, ${questionsPerChunk}, ${chunk_count}, 'processing', ${context.userId})
      RETURNING job_id
    ` as { job_id: string }[];

    const jobId = jobResult[0]?.job_id;
    if (!jobId) {
      return createErrorResponse('Failed to create Q&A generation job', 500);
    }

    // Update job to started
    await sql`
      UPDATE qa_generation_jobs 
      SET started_at = NOW() 
      WHERE job_id = ${jobId}
    `;

    // Get prompt configuration
    const promptConfig = await getPromptConfig('generate_chunk_qa');
    const documentTitle = chunks[0]?.content?.title || 'Unknown Document';

    console.log(`Starting Q&A generation for ${chunks.length} chunks, job ${jobId}`);

    let totalQAGenerated = 0;
    let processedChunks = 0;

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) {
        console.log(`Chunk ${i} is null/undefined, skipping`);
        continue;
      }

      console.log(`Processing chunk ${i + 1}/${chunks.length}`);

      try {
        const qaPairs = await generateQAForChunk(
          chunk,
          i + 1,
          questionsPerChunk,
          documentTitle,
          promptConfig
        );

        // Insert Q&A pairs
        for (const qa of qaPairs) {
          await sql`
            INSERT INTO chunk_qa_pairs (
              job_id, blob_id, tenant_id, chunk_index, chunk_text,
              question, answer, status, generated_by
            ) VALUES (
              ${jobId}, ${blobId}, ${tenantId}, ${i + 1}, ${chunk.content.chunkText},
              ${qa.question}, ${qa.answer}, 'pending', ${promptConfig.modelName}
            )
          `;
          totalQAGenerated++;
        }

        processedChunks++;

        // Update job progress
        await sql`
          UPDATE qa_generation_jobs 
          SET processed_chunks = ${processedChunks}, total_qa_generated = ${totalQAGenerated}
          WHERE job_id = ${jobId}
        `;
      } catch (chunkError) {
        const chunkErrorMsg = chunkError instanceof Error ? chunkError.message : 'Unknown chunk error';
        console.error(`Error processing chunk ${i + 1}:`, chunkErrorMsg, chunkError);
        // Store error in job record
        await sql`
          UPDATE qa_generation_jobs 
          SET error_message = ${`Chunk ${i + 1}: ${chunkErrorMsg}`}
          WHERE job_id = ${jobId}
        `;
      }
    }

    // Mark job as completed
    await sql`
      UPDATE qa_generation_jobs 
      SET status = 'completed', completed_at = NOW(), 
          processed_chunks = ${processedChunks}, total_qa_generated = ${totalQAGenerated}
      WHERE job_id = ${jobId}
    `;

    return createSuccessResponse({
      jobId,
      totalChunks: chunks.length,
      processedChunks,
      totalQAGenerated,
      message: 'Q&A generation completed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Q&A generation error:', errorMessage, error);
    return createErrorResponse(`Failed to generate Q&A pairs: ${errorMessage}`, 500);
  }
}
