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
  tenant_name?: string;
}

interface FolderRow {
  folder_id: string;
  tenant_id: string;
  folder_name: string;
  folder_path: string;
  parent_path: string;
  created_at: string;
  file_count: string;
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
  const allTenants = url.searchParams.get('allTenants') === 'true';

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  // Admin can view all tenants if requested
  if (allTenants && !context.isAdmin) {
    return createErrorResponse('Admin access required for all tenants view', 403);
  }

  let targetTenantId: string | null = null;

  if (!allTenants) {
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
  }

  try {
    // Admin all-tenants view
    if (allTenants && context.isAdmin) {
      const files = await sql`
        SELECT 
          f.file_id, f.tenant_id, f.user_id, f.blob_key, f.file_name, f.file_path, 
          f.mime_type, f.file_size, f.created_at, f.updated_at,
          bi.status AS extraction_status,
          t.name AS tenant_name,
          (SELECT ej.chunk_count FROM extraction_jobs ej 
           WHERE ej.blob_id = bi.blob_id AND ej.status = 'completed'
           ORDER BY ej.completed_at DESC LIMIT 1) AS chunk_count
        FROM files f
        LEFT JOIN blob_inventory bi ON f.blob_key = bi.blob_key
        LEFT JOIN tenants t ON f.tenant_id = t.tenant_id
        ORDER BY t.name, f.file_name
      ` as FileRow[];

      const totalCountResult = await sql`
        SELECT COUNT(*) as total FROM files
      ` as { total: string }[];
      const totalFileCount = parseInt(totalCountResult[0]?.total || '0', 10);

      return createSuccessResponse({
        path: '/',
        tenantId: null,
        allTenants: true,
        totalFileCount,
        files: files.map((f) => ({
          id: f.file_id,
          tenantId: f.tenant_id,
          tenantName: f.tenant_name,
          name: f.file_name,
          path: f.file_path,
          mimeType: f.mime_type,
          size: f.file_size,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
          extractionStatus: f.extraction_status,
          chunkCount: f.chunk_count,
        })),
        folders: [],
      });
    }

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
      SELECT 
        fo.folder_id, fo.tenant_id, fo.folder_name, fo.folder_path, fo.parent_path, fo.created_at,
        (SELECT COUNT(*) FROM files fi WHERE fi.tenant_id = fo.tenant_id AND fi.file_path = fo.folder_path) AS file_count
      FROM folders fo
      WHERE fo.tenant_id = ${targetTenantId} AND fo.parent_path = ${path}
      ORDER BY fo.folder_name
    ` as FolderRow[];

    // Get total file count for this tenant
    const totalCountResult = await sql`
      SELECT COUNT(*) as total FROM files WHERE tenant_id = ${targetTenantId}
    ` as { total: string }[];
    const totalFileCount = parseInt(totalCountResult[0]?.total || '0', 10);

    return createSuccessResponse({
      path,
      tenantId: targetTenantId,
      totalFileCount,
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
        fileCount: parseInt(f.file_count, 10) || 0,
      })),
    });
  } catch (error) {
    console.error('Error listing files:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
