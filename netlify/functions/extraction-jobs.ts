import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface ExtractionJobRow {
  job_id: string;
  blob_id: string;
  extraction_version: string;
  model_version: string | null;
  prompt_hash: string | null;
  status: string;
  error_message: string | null;
  retry_count: number;
  processing_time_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  chunk_count: number | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  correlation_id: string | null;
  file_name: string;
  mime_type: string | null;
}

interface JobStatsRow {
  date: string;
  jobs_completed: string;
  total_chunks: string;
  avg_processing_ms: string;
  total_tokens: string;
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
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

  try {
    if (req.method === 'GET') {
      const jobId = url.searchParams.get('id');
      const statsOnly = url.searchParams.get('stats') === 'true';

      if (statsOnly) {
        const stats = await sql`
          SELECT 
            DATE(completed_at) as date,
            COUNT(*) as jobs_completed,
            COALESCE(SUM(chunk_count), 0) as total_chunks,
            COALESCE(AVG(processing_time_ms), 0) as avg_processing_ms,
            COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens
          FROM extraction_jobs
          WHERE status = 'completed' AND completed_at IS NOT NULL
          GROUP BY DATE(completed_at)
          ORDER BY DATE(completed_at) DESC
          LIMIT 30
        ` as JobStatsRow[];

        const summary = await sql`
          SELECT 
            COUNT(*) FILTER (WHERE status = 'queued') as queued,
            COUNT(*) FILTER (WHERE status = 'running') as running,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'failed') as failed
          FROM extraction_jobs
        ` as { queued: string; running: string; completed: string; failed: string }[];

        return createSuccessResponse({
          stats: stats.map(row => ({
            date: row.date,
            jobsCompleted: parseInt(row.jobs_completed, 10),
            totalChunks: parseInt(row.total_chunks, 10),
            avgProcessingMs: parseFloat(row.avg_processing_ms),
            totalTokens: parseInt(row.total_tokens, 10),
          })),
          summary: {
            queued: parseInt(summary[0]?.queued || '0', 10),
            running: parseInt(summary[0]?.running || '0', 10),
            completed: parseInt(summary[0]?.completed || '0', 10),
            failed: parseInt(summary[0]?.failed || '0', 10),
          },
        });
      }

      if (jobId) {
        const jobs = await sql`
          SELECT 
            ej.*,
            bi.file_name,
            bi.mime_type
          FROM extraction_jobs ej
          JOIN blob_inventory bi ON ej.blob_id = bi.blob_id
          WHERE ej.job_id = ${jobId}
        ` as ExtractionJobRow[];

        const job = jobs[0];
        if (!job) {
          return createErrorResponse('Job not found', 404);
        }

        const outputs = await sql`
          SELECT * FROM extraction_outputs
          WHERE job_id = ${jobId}
        `;

        return createSuccessResponse({
          job: {
            id: job.job_id,
            blobId: job.blob_id,
            fileName: job.file_name,
            mimeType: job.mime_type,
            extractionVersion: job.extraction_version,
            modelVersion: job.model_version,
            promptHash: job.prompt_hash,
            status: job.status,
            errorMessage: job.error_message,
            retryCount: job.retry_count,
            processingTimeMs: job.processing_time_ms,
            inputTokens: job.input_tokens,
            outputTokens: job.output_tokens,
            chunkCount: job.chunk_count,
            queuedAt: job.queued_at,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            correlationId: job.correlation_id,
          },
          outputs,
        });
      }

      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      let jobs: ExtractionJobRow[];

      if (status) {
        jobs = await sql`
          SELECT 
            ej.*,
            bi.file_name,
            bi.mime_type
          FROM extraction_jobs ej
          JOIN blob_inventory bi ON ej.blob_id = bi.blob_id
          WHERE ej.status = ${status}
          ORDER BY ej.queued_at DESC
          LIMIT ${limit} OFFSET ${offset}
        ` as ExtractionJobRow[];
      } else {
        jobs = await sql`
          SELECT 
            ej.*,
            bi.file_name,
            bi.mime_type
          FROM extraction_jobs ej
          JOIN blob_inventory bi ON ej.blob_id = bi.blob_id
          ORDER BY ej.queued_at DESC
          LIMIT ${limit} OFFSET ${offset}
        ` as ExtractionJobRow[];
      }

      return createSuccessResponse({
        jobs: jobs.map(job => ({
          id: job.job_id,
          blobId: job.blob_id,
          fileName: job.file_name,
          mimeType: job.mime_type,
          extractionVersion: job.extraction_version,
          status: job.status,
          chunkCount: job.chunk_count,
          queuedAt: job.queued_at,
          completedAt: job.completed_at,
        })),
        limit,
        offset,
      });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error in extraction-jobs:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
