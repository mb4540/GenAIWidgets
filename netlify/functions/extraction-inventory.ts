import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface BlobInventoryRow {
  blob_id: string;
  tenant_id: string;
  source_store: string;
  blob_key: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  byte_hash_sha256: string | null;
  status: string;
  extraction_priority: number;
  discovered_at: string;
  updated_at: string;
}

interface LineageRow {
  blob_id: string;
  file_name: string;
  blob_status: string;
  job_id: string | null;
  job_status: string | null;
  extraction_version: string | null;
  chunk_count: number | null;
  output_blob_key: string | null;
  extracted_at: string | null;
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
      const blobId = url.searchParams.get('id');
      
      if (blobId) {
        const lineage = await sql`
          SELECT 
            bi.blob_id,
            bi.file_name,
            bi.status AS blob_status,
            ej.job_id,
            ej.status AS job_status,
            ej.extraction_version,
            ej.chunk_count,
            eo.output_blob_key,
            eo.created_at AS extracted_at
          FROM blob_inventory bi
          LEFT JOIN extraction_jobs ej ON bi.blob_id = ej.blob_id
          LEFT JOIN extraction_outputs eo ON ej.job_id = eo.job_id
          WHERE bi.blob_id = ${blobId}
          ORDER BY ej.queued_at DESC
        ` as LineageRow[];

        if (lineage.length === 0) {
          return createErrorResponse('Blob not found', 404);
        }

        return createSuccessResponse({ lineage });
      }

      const status = url.searchParams.get('status');
      const tenantId = url.searchParams.get('tenantId');
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      let inventory: BlobInventoryRow[];

      if (status && tenantId) {
        inventory = await sql`
          SELECT * FROM blob_inventory
          WHERE status = ${status} AND tenant_id = ${tenantId}
          ORDER BY discovered_at DESC
          LIMIT ${limit} OFFSET ${offset}
        ` as BlobInventoryRow[];
      } else if (status) {
        inventory = await sql`
          SELECT * FROM blob_inventory
          WHERE status = ${status}
          ORDER BY discovered_at DESC
          LIMIT ${limit} OFFSET ${offset}
        ` as BlobInventoryRow[];
      } else if (tenantId) {
        inventory = await sql`
          SELECT * FROM blob_inventory
          WHERE tenant_id = ${tenantId}
          ORDER BY discovered_at DESC
          LIMIT ${limit} OFFSET ${offset}
        ` as BlobInventoryRow[];
      } else {
        inventory = await sql`
          SELECT * FROM blob_inventory
          ORDER BY discovered_at DESC
          LIMIT ${limit} OFFSET ${offset}
        ` as BlobInventoryRow[];
      }

      const countResult = await sql`
        SELECT COUNT(*) as total FROM blob_inventory
      ` as { total: string }[];

      return createSuccessResponse({
        inventory: inventory.map(row => ({
          id: row.blob_id,
          tenantId: row.tenant_id,
          sourceStore: row.source_store,
          blobKey: row.blob_key,
          fileName: row.file_name,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          byteHashSha256: row.byte_hash_sha256,
          status: row.status,
          extractionPriority: row.extraction_priority,
          discoveredAt: row.discovered_at,
          updatedAt: row.updated_at,
        })),
        total: parseInt(countResult[0]?.total || '0', 10),
        limit,
        offset,
      });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error in extraction-inventory:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
