import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse } from './lib/auth';

const BLOB_STORE_NAME = 'user-files';

interface FileRow {
  file_id: string;
  tenant_id: string;
  blob_key: string;
  file_name: string;
  mime_type: string | null;
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
  const fileId = url.searchParams.get('id');

  if (!fileId) {
    return createErrorResponse('File ID required', 400);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  try {
    const files = await sql`
      SELECT file_id, tenant_id, blob_key, file_name, mime_type
      FROM files
      WHERE file_id = ${fileId}
    ` as FileRow[];

    const file = files[0];
    if (!file) {
      return createErrorResponse('File not found', 404);
    }

    if (!context.isAdmin && file.tenant_id !== context.tenantId) {
      return createErrorResponse('Forbidden', 403);
    }

    const store = getStore(BLOB_STORE_NAME);
    const blob = await store.get(file.blob_key, { type: 'blob' });

    if (!blob) {
      return createErrorResponse('File content not found', 404);
    }

    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.file_name)}"`,
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
