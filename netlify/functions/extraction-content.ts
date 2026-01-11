import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

const OUTPUT_STORE_NAME = 'extracted-chunks';

interface ExtractionOutputRow {
  output_id: string;
  job_id: string;
  blob_id: string;
  output_store: string;
  output_blob_key: string;
  output_type: string;
  chunk_count: number;
  size_bytes: number;
  schema_version: string;
  created_at: string;
}

interface ChunkRecord {
  content: {
    title: string | null;
    chunkText: string;
    language: string;
  };
  provenance: {
    pageStart: number | null;
    pageEnd: number | null;
    sectionPath: string[];
  };
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'GET') {
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
  const url = new URL(req.url);
  const blobIdParam = url.searchParams.get('blobId');
  const fileIdParam = url.searchParams.get('fileId');

  if (!blobIdParam && !fileIdParam) {
    return createErrorResponse('blobId or fileId parameter is required', 400);
  }

  try {
    let blobId = blobIdParam;

    // If fileId is provided, look up the blob_id via the files table
    if (fileIdParam && !blobId) {
      const fileResult = await sql`
        SELECT bi.blob_id
        FROM files f
        JOIN blob_inventory bi ON f.blob_key = bi.blob_key
        WHERE f.file_id = ${fileIdParam}
      ` as { blob_id: string }[];

      if (!fileResult[0]) {
        return createErrorResponse('No extraction output found for this blob', 404);
      }
      blobId = fileResult[0].blob_id;
    }

    // Get the latest extraction output for this blob
    const outputs = await sql`
      SELECT eo.* 
      FROM extraction_outputs eo
      JOIN extraction_jobs ej ON eo.job_id = ej.job_id
      WHERE eo.blob_id = ${blobId}
      ORDER BY ej.completed_at DESC
      LIMIT 1
    ` as ExtractionOutputRow[];

    if (!outputs[0]) {
      return createErrorResponse('No extraction output found for this blob', 404);
    }

    const output = outputs[0];

    // Fetch the JSONL content from blob store
    const outputStore = getStore(OUTPUT_STORE_NAME);
    const jsonlContent = await outputStore.get(output.output_blob_key, { type: 'text' });

    if (!jsonlContent) {
      return createErrorResponse('Extraction content not found in blob store', 404);
    }

    // Parse JSONL into chunks
    const chunks: ChunkRecord[] = jsonlContent
      .split('\n')
      .filter((line: string) => line.trim())
      .map((line: string) => JSON.parse(line) as ChunkRecord);

    // Reconstruct the extracted content structure
    const title = chunks[0]?.content?.title || null;
    const language = chunks[0]?.content?.language || 'en';
    
    // Build individual chunks array with metadata
    const individualChunks = chunks.map((chunk, index) => ({
      index: index + 1,
      text: chunk.content.chunkText,
      pageStart: chunk.provenance?.pageStart || null,
      pageEnd: chunk.provenance?.pageEnd || null,
      sectionPath: chunk.provenance?.sectionPath || [],
    }));

    // Also build merged fullText for backward compatibility
    const fullText = chunks.map(c => c.content.chunkText).join('\n\n');

    return createSuccessResponse({
      blobId,
      outputId: output.output_id,
      chunkCount: output.chunk_count,
      extractedAt: output.created_at,
      content: {
        title,
        language,
        fullText,
        chunks: individualChunks,
      },
    });
  } catch (error) {
    console.error('Error fetching extraction content:', error);
    return createErrorResponse('Failed to fetch extraction content', 500);
  }
}
