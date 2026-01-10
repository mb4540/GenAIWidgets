import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

const BLOB_STORE_NAME = 'user-files';

interface FolderRow {
  folder_id: string;
  tenant_id: string;
  folder_path: string;
}

interface FileRow {
  blob_key: string;
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'DELETE') {
    return createErrorResponse('Method not allowed', 405);
  }

  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return createErrorResponse(authResult.error, authResult.status);
  }

  const { context } = authResult;
  const url = new URL(req.url);
  const folderId = url.searchParams.get('id');

  if (!folderId) {
    return createErrorResponse('Folder ID required', 400);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  try {
    const folders = await sql`
      SELECT folder_id, tenant_id, folder_path
      FROM folders
      WHERE folder_id = ${folderId}
    ` as FolderRow[];

    const folder = folders[0];
    if (!folder) {
      return createErrorResponse('Folder not found', 404);
    }

    if (!context.isAdmin && folder.tenant_id !== context.tenantId) {
      return createErrorResponse('Forbidden', 403);
    }

    const filesToDelete = await sql`
      SELECT blob_key FROM files
      WHERE tenant_id = ${folder.tenant_id} 
        AND (file_path = ${folder.folder_path} OR file_path LIKE ${folder.folder_path + '%'})
    ` as FileRow[];

    const store = getStore(BLOB_STORE_NAME);
    for (const file of filesToDelete) {
      await store.delete(file.blob_key);
    }

    await sql`
      DELETE FROM files
      WHERE tenant_id = ${folder.tenant_id}
        AND (file_path = ${folder.folder_path} OR file_path LIKE ${folder.folder_path + '%'})
    `;

    await sql`
      DELETE FROM folders
      WHERE tenant_id = ${folder.tenant_id}
        AND (folder_path = ${folder.folder_path} OR folder_path LIKE ${folder.folder_path + '%'})
    `;

    return createSuccessResponse({
      deleted: true,
      folderId,
      filesDeleted: filesToDelete.length,
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
