import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { neon } from '@neondatabase/serverless';
import { v4 as uuid } from 'uuid';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

const BLOB_STORE_NAME = 'user-files';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return createErrorResponse(authResult.error, authResult.status);
  }

  const { context } = authResult;

  if (!context.tenantId && !context.isAdmin) {
    return createErrorResponse('No tenant context', 400);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  try {
    const contentType = req.headers.get('Content-Type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return createErrorResponse('Content-Type must be multipart/form-data', 400);
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const filePath = (formData.get('path') as string) || '/';
    const targetTenantId = context.isAdmin
      ? (formData.get('tenantId') as string) || context.tenantId
      : context.tenantId;

    if (!file) {
      return createErrorResponse('No file provided', 400);
    }

    if (!targetTenantId) {
      return createErrorResponse('No tenant specified', 400);
    }

    if (!context.isAdmin && targetTenantId !== context.tenantId) {
      return createErrorResponse('Forbidden', 403);
    }

    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400);
    }

    const blobKey = uuid();
    const store = getStore(BLOB_STORE_NAME);

    const { etag } = await store.set(blobKey, file, {
      metadata: {
        fileName: file.name,
        mimeType: file.type,
        uploadedBy: context.userId,
        tenantId: targetTenantId,
      },
    });

    const sql = neon(DATABASE_URL);

    const result = await sql`
      INSERT INTO files (tenant_id, user_id, blob_key, file_name, file_path, mime_type, file_size, etag)
      VALUES (${targetTenantId}, ${context.userId}, ${blobKey}, ${file.name}, ${filePath}, ${file.type}, ${file.size}, ${etag || null})
      RETURNING file_id, created_at, updated_at
    ` as { file_id: string; created_at: string; updated_at: string }[];

    const inserted = result[0];

    return createSuccessResponse({
      file: {
        id: inserted.file_id,
        name: file.name,
        path: filePath,
        mimeType: file.type,
        size: file.size,
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
