import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface BulkApproveRequest {
  qaIds?: string[];
  blobId?: string;
  fileId?: string;
  approveAll?: boolean;
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

  let body: BulkApproveRequest;
  try {
    body = (await req.json()) as BulkApproveRequest;
  } catch {
    return createErrorResponse('Invalid JSON body', 400);
  }

  const { qaIds, blobId: blobIdParam, fileId, approveAll } = body;

  if (!qaIds?.length && !approveAll) {
    return createErrorResponse('qaIds array or approveAll flag is required', 400);
  }

  try {
    let approvedCount = 0;

    if (approveAll && (blobIdParam || fileId)) {
      // Approve all pending Q&A pairs for a blob
      let blobId = blobIdParam;
      let tenantId = context.tenantId;

      if (fileId && !blobId) {
        const fileResult = await sql`
          SELECT bi.blob_id, f.tenant_id
          FROM files f
          JOIN blob_inventory bi ON f.blob_key = bi.blob_key
          WHERE f.file_id = ${fileId}
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

      const result = await sql`
        UPDATE chunk_qa_pairs
        SET status = 'approved', reviewed_at = NOW(), reviewed_by = ${context.userId}
        WHERE blob_id = ${blobId} AND status = 'pending'
        RETURNING qa_id
      ` as { qa_id: string }[];

      approvedCount = result.length;
    } else if (qaIds?.length) {
      // Approve specific Q&A pairs
      for (const qaId of qaIds) {
        // Verify access for each Q&A pair
        const existing = await sql`
          SELECT qa_id, tenant_id
          FROM chunk_qa_pairs
          WHERE qa_id = ${qaId}
        ` as { qa_id: string; tenant_id: string }[];

        if (!existing[0]) continue;

        if (!context.isAdmin && existing[0].tenant_id !== context.tenantId) {
          continue;
        }

        await sql`
          UPDATE chunk_qa_pairs
          SET status = 'approved', reviewed_at = NOW(), reviewed_by = ${context.userId}
          WHERE qa_id = ${qaId} AND status = 'pending'
        `;
        approvedCount++;
      }
    }

    return createSuccessResponse({
      approvedCount,
      message: `${approvedCount} Q&A pair(s) approved`,
    });
  } catch (error) {
    console.error('Error bulk approving Q&A pairs:', error);
    return createErrorResponse('Failed to approve Q&A pairs', 500);
  }
}
