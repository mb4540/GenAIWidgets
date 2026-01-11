import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface QAPairRow {
  qa_id: string;
  job_id: string;
  blob_id: string;
  chunk_index: number;
  chunk_text: string | null;
  question: string;
  answer: string;
  status: string;
  generated_by: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface JobRow {
  job_id: string;
  status: string;
  questions_per_chunk: number;
  total_chunks: number | null;
  processed_chunks: number;
  total_qa_generated: number;
  created_at: string;
  completed_at: string | null;
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

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);
  const url = new URL(req.url);
  const blobIdParam = url.searchParams.get('blobId');
  const fileIdParam = url.searchParams.get('fileId');
  const statusFilter = url.searchParams.get('status');

  if (!blobIdParam && !fileIdParam) {
    return createErrorResponse('blobId or fileId parameter is required', 400);
  }

  try {
    let blobId = blobIdParam;
    let tenantId = context.tenantId;

    // If fileId is provided, look up the blob_id
    if (fileIdParam && !blobId) {
      const fileResult = await sql`
        SELECT bi.blob_id, f.tenant_id
        FROM files f
        JOIN blob_inventory bi ON f.blob_key = bi.blob_key
        WHERE f.file_id = ${fileIdParam}
      ` as { blob_id: string; tenant_id: string }[];

      if (!fileResult[0]) {
        return createErrorResponse('File not found', 404);
      }
      blobId = fileResult[0].blob_id;
      tenantId = fileResult[0].tenant_id;
    }

    // Verify tenant access
    if (!context.isAdmin && tenantId !== context.tenantId) {
      return createErrorResponse('Forbidden', 403);
    }

    // Get latest job for this blob
    const jobs = await sql`
      SELECT job_id, status, questions_per_chunk, total_chunks, processed_chunks, 
             total_qa_generated, created_at, completed_at
      FROM qa_generation_jobs
      WHERE blob_id = ${blobId}
      ORDER BY created_at DESC
      LIMIT 1
    ` as JobRow[];

    const job = jobs[0] || null;

    // Get Q&A pairs with optional status filter
    let qaPairs: QAPairRow[];
    if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
      qaPairs = await sql`
        SELECT qa_id, job_id, blob_id, chunk_index, chunk_text, question, answer, 
               status, generated_by, created_at, reviewed_at
        FROM chunk_qa_pairs
        WHERE blob_id = ${blobId} AND status = ${statusFilter}
        ORDER BY chunk_index, created_at
      ` as QAPairRow[];
    } else {
      qaPairs = await sql`
        SELECT qa_id, job_id, blob_id, chunk_index, chunk_text, question, answer, 
               status, generated_by, created_at, reviewed_at
        FROM chunk_qa_pairs
        WHERE blob_id = ${blobId}
        ORDER BY chunk_index, created_at
      ` as QAPairRow[];
    }

    // Calculate stats
    const stats = {
      total: qaPairs.length,
      pending: qaPairs.filter(qa => qa.status === 'pending').length,
      approved: qaPairs.filter(qa => qa.status === 'approved').length,
      rejected: qaPairs.filter(qa => qa.status === 'rejected').length,
    };

    return createSuccessResponse({
      blobId,
      job: job ? {
        jobId: job.job_id,
        status: job.status,
        questionsPerChunk: job.questions_per_chunk,
        totalChunks: job.total_chunks,
        processedChunks: job.processed_chunks,
        totalQAGenerated: job.total_qa_generated,
        createdAt: job.created_at,
        completedAt: job.completed_at,
      } : null,
      qaPairs: qaPairs.map(qa => ({
        qaId: qa.qa_id,
        jobId: qa.job_id,
        chunkIndex: qa.chunk_index,
        chunkText: qa.chunk_text,
        question: qa.question,
        answer: qa.answer,
        status: qa.status,
        generatedBy: qa.generated_by,
        createdAt: qa.created_at,
        reviewedAt: qa.reviewed_at,
      })),
      stats,
    });
  } catch (error) {
    console.error('Error fetching Q&A pairs:', error);
    return createErrorResponse('Failed to fetch Q&A pairs', 500);
  }
}
