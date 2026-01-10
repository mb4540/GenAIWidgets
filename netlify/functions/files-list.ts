import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface FileRow {
  file_id: string;
  tenant_id: string;
  user_id: string;
  blob_key: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
  extraction_status: string | null;
  chunk_count: number | null;
}

interface FolderRow {
  folder_id: string;
  tenant_id: string;
  folder_name: string;
  folder_path: string;
  parent_path: string;
  created_at: string;
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
  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '/';
  const tenantIdParam = url.searchParams.get('tenantId');

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  let targetTenantId: string;

  if (context.isAdmin && tenantIdParam) {
    targetTenantId = tenantIdParam;
  } else if (context.tenantId) {
    targetTenantId = context.tenantId;
  } else {
    return createErrorResponse('No tenant context', 400);
  }

  if (!context.isAdmin && targetTenantId !== context.tenantId) {
    return createErrorResponse('Forbidden', 403);
  }

  try {
    const files = await sql`
      SELECT 
        f.file_id, f.tenant_id, f.user_id, f.blob_key, f.file_name, f.file_path, 
        f.mime_type, f.file_size, f.created_at, f.updated_at,
        bi.status AS extraction_status,
        (SELECT ej.chunk_count FROM extraction_jobs ej 
         WHERE ej.blob_id = bi.blob_id AND ej.status = 'completed'
         ORDER BY ej.completed_at DESC LIMIT 1) AS chunk_count
      FROM files f
      LEFT JOIN blob_inventory bi ON f.blob_key = bi.blob_key
      WHERE f.tenant_id = ${targetTenantId} AND f.file_path = ${path}
      ORDER BY f.file_name
    ` as FileRow[];

    const folders = await sql`
      SELECT folder_id, tenant_id, folder_name, folder_path, parent_path, created_at
      FROM folders
      WHERE tenant_id = ${targetTenantId} AND parent_path = ${path}
      ORDER BY folder_name
    ` as FolderRow[];

    return createSuccessResponse({
      path,
      tenantId: targetTenantId,
      files: files.map((f) => ({
        id: f.file_id,
        name: f.file_name,
        path: f.file_path,
        mimeType: f.mime_type,
        size: f.file_size,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
        extractionStatus: f.extraction_status,
        chunkCount: f.chunk_count,
      })),
      folders: folders.map((f) => ({
        id: f.folder_id,
        name: f.folder_name,
        path: f.folder_path,
        createdAt: f.created_at,
      })),
    });
  } catch (error) {
    console.error('Error listing files:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
