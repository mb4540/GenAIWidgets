import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

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
    const body = await req.json() as {
      name: string;
      parentPath?: string;
      tenantId?: string;
    };

    const { name, parentPath = '/' } = body;
    const targetTenantId = context.isAdmin && body.tenantId
      ? body.tenantId
      : context.tenantId;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return createErrorResponse('Folder name is required', 400);
    }

    if (!targetTenantId) {
      return createErrorResponse('No tenant specified', 400);
    }

    if (!context.isAdmin && targetTenantId !== context.tenantId) {
      return createErrorResponse('Forbidden', 403);
    }

    const sanitizedName = name.trim().replace(/[/\\]/g, '-');
    const normalizedParentPath = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
    const folderPath = `${normalizedParentPath}${sanitizedName}/`;

    const sql = neon(DATABASE_URL);

    const existing = await sql`
      SELECT folder_id FROM folders
      WHERE tenant_id = ${targetTenantId} AND folder_path = ${folderPath}
    ` as { folder_id: string }[];

    if (existing.length > 0) {
      return createErrorResponse('Folder already exists', 409);
    }

    const result = await sql`
      INSERT INTO folders (tenant_id, user_id, folder_name, folder_path, parent_path)
      VALUES (${targetTenantId}, ${context.userId}, ${sanitizedName}, ${folderPath}, ${normalizedParentPath})
      RETURNING folder_id, created_at
    ` as { folder_id: string; created_at: string }[];

    const inserted = result[0];
    if (!inserted) {
      return createErrorResponse('Failed to create folder', 500);
    }

    return createSuccessResponse({
      folder: {
        id: inserted.folder_id,
        name: sanitizedName,
        path: folderPath,
        parentPath: normalizedParentPath,
        createdAt: inserted.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
