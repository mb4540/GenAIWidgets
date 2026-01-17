import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { neon } from '@neondatabase/serverless';
import { v4 as uuid } from 'uuid';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

const BLOB_STORE_NAME = 'user-files';
const MAX_READ_SIZE = 1 * 1024 * 1024; // 1MB max for reading

const TEXT_MIME_TYPES = [
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'text/markdown',
  'text/csv',
  'text/xml',
  'application/json',
  'application/xml',
  'application/javascript',
];

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
}

interface FolderRow {
  folder_id: string;
  folder_name: string;
  folder_path: string;
  created_at: string;
}

interface ToolInput {
  action: 'list' | 'read' | 'create' | 'delete';
  path?: string;
  file_path?: string;
  content?: string;
}

function isTextMimeType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return TEXT_MIME_TYPES.some(t => mimeType.startsWith(t));
}

function sanitizePath(path: string): string {
  // Normalize path and prevent directory traversal
  let normalized = path.replace(/\\/g, '/');
  normalized = normalized.replace(/\.{2,}/g, ''); // Remove ..
  normalized = normalized.replace(/\/+/g, '/'); // Collapse multiple slashes
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  return normalized;
}

function extractFolderAndFileName(filePath: string): { folderPath: string; fileName: string } {
  const sanitized = sanitizePath(filePath);
  const lastSlash = sanitized.lastIndexOf('/');
  if (lastSlash === 0) {
    return { folderPath: '/', fileName: sanitized.substring(1) };
  }
  return {
    folderPath: sanitized.substring(0, lastSlash),
    fileName: sanitized.substring(lastSlash + 1),
  };
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    const authError = authResult as { success: false; error: string; status: number };
    return createErrorResponse(authError.error, authError.status);
  }

  const { userId, tenantId } = authResult.context;

  if (!tenantId) {
    return createErrorResponse('Tenant context required', 400);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  try {
    const body = await req.json() as ToolInput;
    const { action } = body;

    if (!action) {
      return createErrorResponse('Action is required', 400);
    }

    // LIST FILES
    if (action === 'list') {
      const path = sanitizePath(body.path || '/');
      
      const files = await sql`
        SELECT file_id, file_name, file_path, mime_type, file_size, created_at
        FROM files
        WHERE tenant_id = ${tenantId} AND file_path = ${path}
        ORDER BY file_name
      ` as FileRow[];

      const folders = await sql`
        SELECT folder_id, folder_name, folder_path, created_at
        FROM folders
        WHERE tenant_id = ${tenantId} AND parent_path = ${path}
        ORDER BY folder_name
      ` as FolderRow[];

      return createSuccessResponse({
        result: {
          path,
          folders: folders.map(f => ({
            name: f.folder_name,
            path: f.folder_path,
            type: 'folder',
          })),
          files: files.map(f => ({
            name: f.file_name,
            path: f.file_path + '/' + f.file_name,
            size: f.file_size,
            type: f.mime_type || 'unknown',
          })),
          total_files: files.length,
          total_folders: folders.length,
        },
      });
    }

    // READ FILE
    if (action === 'read') {
      if (!body.file_path) {
        return createErrorResponse('file_path is required', 400);
      }

      const { folderPath, fileName } = extractFolderAndFileName(body.file_path);

      const files = await sql`
        SELECT file_id, blob_key, file_name, mime_type, file_size
        FROM files
        WHERE tenant_id = ${tenantId} 
          AND file_path = ${folderPath}
          AND file_name = ${fileName}
      ` as FileRow[];

      const file = files[0];
      if (!file) {
        return createErrorResponse(`File not found: ${body.file_path}`, 404);
      }

      if (!isTextMimeType(file.mime_type)) {
        return createErrorResponse(`Cannot read binary file. File type: ${file.mime_type}`, 400);
      }

      if (file.file_size && file.file_size > MAX_READ_SIZE) {
        return createErrorResponse(`File too large to read. Max size: ${MAX_READ_SIZE / 1024}KB`, 400);
      }

      const store = getStore(BLOB_STORE_NAME);
      const blob = await store.get(file.blob_key, { type: 'text' });

      if (!blob) {
        return createErrorResponse('File content not found', 404);
      }

      return createSuccessResponse({
        result: {
          file_name: file.file_name,
          path: body.file_path,
          content: blob,
          size: file.file_size,
          type: file.mime_type,
        },
      });
    }

    // CREATE FILE
    if (action === 'create') {
      if (!body.file_path) {
        return createErrorResponse('file_path is required', 400);
      }
      if (body.content === undefined) {
        return createErrorResponse('content is required', 400);
      }

      const { folderPath, fileName } = extractFolderAndFileName(body.file_path);

      if (!fileName) {
        return createErrorResponse('Invalid file path', 400);
      }

      // Determine mime type from extension
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const mimeTypeMap: Record<string, string> = {
        txt: 'text/plain',
        md: 'text/markdown',
        json: 'application/json',
        csv: 'text/csv',
        html: 'text/html',
        css: 'text/css',
        js: 'application/javascript',
        xml: 'application/xml',
      };
      const mimeType = mimeTypeMap[ext] || 'text/plain';

      // Ensure folder exists
      if (folderPath !== '/') {
        const existingFolder = await sql`
          SELECT folder_id FROM folders
          WHERE tenant_id = ${tenantId} AND folder_path = ${folderPath}
        `;

        if (existingFolder.length === 0) {
          // Create folder
          const parentPath = folderPath.substring(0, folderPath.lastIndexOf('/')) || '/';
          const folderName = folderPath.substring(folderPath.lastIndexOf('/') + 1);
          
          await sql`
            INSERT INTO folders (tenant_id, folder_name, folder_path, parent_path)
            VALUES (${tenantId}, ${folderName}, ${folderPath}, ${parentPath})
          `;
        }
      }

      // Check if file already exists
      const existingFiles = await sql`
        SELECT file_id, blob_key FROM files
        WHERE tenant_id = ${tenantId} 
          AND file_path = ${folderPath}
          AND file_name = ${fileName}
      ` as FileRow[];

      const store = getStore(BLOB_STORE_NAME);
      const contentBlob = new Blob([body.content], { type: mimeType });
      const fileSize = contentBlob.size;

      const existingFile = existingFiles[0];
      if (existingFile) {
        // Update existing file
        // Delete old blob
        await store.delete(existingFile.blob_key);
        
        // Upload new content
        const blobKey = uuid();
        await store.set(blobKey, contentBlob, {
          metadata: {
            fileName,
            mimeType,
            uploadedBy: userId,
            tenantId,
          },
        });

        // Update database
        await sql`
          UPDATE files
          SET blob_key = ${blobKey}, file_size = ${fileSize}, mime_type = ${mimeType}, updated_at = now()
          WHERE file_id = ${existingFile.file_id}
        `;

        return createSuccessResponse({
          result: {
            action: 'updated',
            file_id: existingFile.file_id,
            path: body.file_path,
            size: fileSize,
          },
        });
      } else {
        // Create new file
        const blobKey = uuid();
        
        await store.set(blobKey, contentBlob, {
          metadata: {
            fileName,
            mimeType,
            uploadedBy: userId,
            tenantId,
          },
        });

        const result = await sql`
          INSERT INTO files (tenant_id, user_id, blob_key, file_name, file_path, mime_type, file_size)
          VALUES (${tenantId}, ${userId}, ${blobKey}, ${fileName}, ${folderPath}, ${mimeType}, ${fileSize})
          RETURNING file_id
        ` as { file_id: string }[];

        return createSuccessResponse({
          result: {
            action: 'created',
            file_id: result[0]?.file_id,
            path: body.file_path,
            size: fileSize,
          },
        });
      }
    }

    // DELETE FILE
    if (action === 'delete') {
      if (!body.file_path) {
        return createErrorResponse('file_path is required', 400);
      }

      const { folderPath, fileName } = extractFolderAndFileName(body.file_path);

      const files = await sql`
        SELECT file_id, blob_key FROM files
        WHERE tenant_id = ${tenantId} 
          AND file_path = ${folderPath}
          AND file_name = ${fileName}
      ` as FileRow[];

      const file = files[0];
      if (!file) {
        return createErrorResponse(`File not found: ${body.file_path}`, 404);
      }

      const store = getStore(BLOB_STORE_NAME);
      await store.delete(file.blob_key);

      await sql`
        DELETE FROM files WHERE file_id = ${file.file_id}
      `;

      return createSuccessResponse({
        result: {
          action: 'deleted',
          path: body.file_path,
          message: `File ${fileName} has been deleted`,
        },
      });
    }

    return createErrorResponse(`Unknown action: ${action}`, 400);
  } catch (error) {
    console.error('[tool-files] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(`Tool execution failed: ${errorMessage}`, 500);
  }
}
