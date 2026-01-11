import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface FileStats {
  totalFiles: number;
  totalFolders: number;
}

interface ExtractionStats {
  pending: number;
  processing: number;
  extracted: number;
  failed: number;
  totalChunks: number;
}

interface QAStats {
  totalPairs: number;
  pending: number;
  approved: number;
  rejected: number;
  totalJobs: number;
}

interface RecentActivity {
  type: 'extraction' | 'qa_generation';
  fileName: string;
  status: string;
  timestamp: string;
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

  try {
    // File stats (tenant-scoped)
    const fileCountResult = await sql`
      SELECT COUNT(*) as total_files
      FROM files
      WHERE tenant_id = ${context.tenantId}
    ` as { total_files: string }[];

    const folderCountResult = await sql`
      SELECT COUNT(*) as total_folders
      FROM folders
      WHERE tenant_id = ${context.tenantId}
    ` as { total_folders: string }[];

    const fileStats: FileStats = {
      totalFiles: parseInt(fileCountResult[0]?.total_files || '0', 10),
      totalFolders: parseInt(folderCountResult[0]?.total_folders || '0', 10),
    };

    // Extraction stats (tenant-scoped via blob_inventory)
    const extractionStatsResult = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'extracted') as extracted,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM blob_inventory
      WHERE tenant_id = ${context.tenantId}
    ` as { pending: string; processing: string; extracted: string; failed: string }[];

    // Total chunks from extraction jobs
    const chunksResult = await sql`
      SELECT COALESCE(SUM(ej.chunk_count), 0) as total_chunks
      FROM extraction_jobs ej
      JOIN blob_inventory bi ON ej.blob_id = bi.blob_id
      WHERE bi.tenant_id = ${context.tenantId} AND ej.status = 'completed'
    ` as { total_chunks: string }[];

    const extractionStats: ExtractionStats = {
      pending: parseInt(extractionStatsResult[0]?.pending || '0', 10),
      processing: parseInt(extractionStatsResult[0]?.processing || '0', 10),
      extracted: parseInt(extractionStatsResult[0]?.extracted || '0', 10),
      failed: parseInt(extractionStatsResult[0]?.failed || '0', 10),
      totalChunks: parseInt(chunksResult[0]?.total_chunks || '0', 10),
    };

    // Q&A stats (tenant-scoped)
    const qaStatsResult = await sql`
      SELECT 
        COUNT(*) as total_pairs,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected
      FROM chunk_qa_pairs
      WHERE tenant_id = ${context.tenantId}
    ` as { total_pairs: string; pending: string; approved: string; rejected: string }[];

    const qaJobsResult = await sql`
      SELECT COUNT(*) as total_jobs
      FROM qa_generation_jobs
      WHERE tenant_id = ${context.tenantId}
    ` as { total_jobs: string }[];

    const qaStats: QAStats = {
      totalPairs: parseInt(qaStatsResult[0]?.total_pairs || '0', 10),
      pending: parseInt(qaStatsResult[0]?.pending || '0', 10),
      approved: parseInt(qaStatsResult[0]?.approved || '0', 10),
      rejected: parseInt(qaStatsResult[0]?.rejected || '0', 10),
      totalJobs: parseInt(qaJobsResult[0]?.total_jobs || '0', 10),
    };

    // Recent activity (last 10 items)
    const recentExtractions = await sql`
      SELECT 
        'extraction' as type,
        bi.file_name,
        ej.status,
        COALESCE(ej.completed_at, ej.started_at, ej.queued_at) as timestamp
      FROM extraction_jobs ej
      JOIN blob_inventory bi ON ej.blob_id = bi.blob_id
      WHERE bi.tenant_id = ${context.tenantId}
      ORDER BY COALESCE(ej.completed_at, ej.started_at, ej.queued_at) DESC
      LIMIT 5
    ` as { type: string; file_name: string; status: string; timestamp: string }[];

    const recentQAJobs = await sql`
      SELECT 
        'qa_generation' as type,
        bi.file_name,
        qj.status,
        COALESCE(qj.completed_at, qj.started_at, qj.created_at) as timestamp
      FROM qa_generation_jobs qj
      JOIN blob_inventory bi ON qj.blob_id = bi.blob_id
      WHERE qj.tenant_id = ${context.tenantId}
      ORDER BY COALESCE(qj.completed_at, qj.started_at, qj.created_at) DESC
      LIMIT 5
    ` as { type: string; file_name: string; status: string; timestamp: string }[];

    const recentActivity: RecentActivity[] = [
      ...recentExtractions.map(r => ({
        type: 'extraction' as const,
        fileName: r.file_name,
        status: r.status,
        timestamp: r.timestamp,
      })),
      ...recentQAJobs.map(r => ({
        type: 'qa_generation' as const,
        fileName: r.file_name,
        status: r.status,
        timestamp: r.timestamp,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    return createSuccessResponse({
      fileStats,
      extractionStats,
      qaStats,
      recentActivity,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Dashboard stats error:', errorMessage, error);
    return createErrorResponse(`Failed to fetch dashboard stats: ${errorMessage}`, 500);
  }
}
