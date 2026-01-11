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
  const blobId = url.searchParams.get('blobId');

  if (!blobId) {
    return createErrorResponse('blobId parameter is required', 400);
  }

  try {
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
    
    // Group chunks by page
    const pageMap = new Map<number, { text: string; headings: string[] }>();
    
    for (const chunk of chunks) {
      const pageNum = chunk.provenance?.pageStart || 1;
      const existing = pageMap.get(pageNum) || { text: '', headings: [] };
      existing.text += (existing.text ? ' ' : '') + chunk.content.chunkText;
      if (chunk.provenance?.sectionPath?.length) {
        for (const heading of chunk.provenance.sectionPath) {
          if (!existing.headings.includes(heading)) {
            existing.headings.push(heading);
          }
        }
      }
      pageMap.set(pageNum, existing);
    }

    // Convert to pages array
    const pages = Array.from(pageMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([pageNumber, data]) => ({
        pageNumber,
        text: data.text,
        headings: data.headings,
      }));

    // If all chunks are on page 1 (or null), return as fullText instead
    const extractedContent = pages.length === 1 && pages[0]?.pageNumber === 1
      ? {
          title,
          language,
          fullText: pages[0].text,
        }
      : {
          title,
          language,
          pages,
        };

    return createSuccessResponse({
      blobId,
      outputId: output.output_id,
      chunkCount: output.chunk_count,
      extractedAt: output.created_at,
      content: extractedContent,
    });
  } catch (error) {
    console.error('Error fetching extraction content:', error);
    return createErrorResponse('Failed to fetch extraction content', 500);
  }
}
