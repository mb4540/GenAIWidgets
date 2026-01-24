import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

// Whitelist of allowed blob stores for admin access
const ALLOWED_STORES = ['ai-chats-jobs', 'extracted-chunks', 'user-files'];

interface BlobEntry {
  key: string;
  size?: number;
  lastModified?: string;
}

interface BlobListResponse {
  blobs: BlobEntry[];
  cursor?: string;
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  // Authenticate and verify admin access
  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    const authError = authResult as { success: false; error: string; status: number };
    return createErrorResponse(authError.error, authError.status);
  }

  const { isAdmin } = authResult.context;

  if (!isAdmin) {
    return createErrorResponse('Admin access required', 403);
  }

  const url = new URL(req.url);
  const storeName = url.searchParams.get('store');
  const blobKey = url.searchParams.get('key');
  const cursor = url.searchParams.get('cursor');

  // Validate store name
  if (!storeName) {
    return createErrorResponse('Store name is required', 400);
  }

  if (!ALLOWED_STORES.includes(storeName)) {
    return createErrorResponse(`Invalid store name. Allowed: ${ALLOWED_STORES.join(', ')}`, 400);
  }

  try {
    const store = getStore(storeName);

    // GET - List blobs or get single blob content
    if (req.method === 'GET') {
      if (blobKey) {
        // Get single blob content
        const blob = await store.get(blobKey, { type: 'text' });
        
        if (blob === null) {
          return createErrorResponse('Blob not found', 404);
        }

        // Try to parse as JSON for better display
        let content: unknown = blob;
        let isJson = false;
        try {
          content = JSON.parse(blob);
          isJson = true;
        } catch {
          // Not JSON, keep as string
        }

        return createSuccessResponse({
          key: blobKey,
          content,
          isJson,
          size: blob.length,
        });
      } else {
        // List all blobs in store
        const listResult = await store.list();
        
        const blobs: BlobEntry[] = listResult.blobs.map(b => ({
          key: b.key,
        }));

        const response: BlobListResponse = {
          blobs,
        };

        return createSuccessResponse(response);
      }
    }

    // PUT - Update blob content
    if (req.method === 'PUT') {
      if (!blobKey) {
        return createErrorResponse('Blob key is required', 400);
      }

      const body = await req.json() as { content: unknown };
      
      if (body.content === undefined) {
        return createErrorResponse('Content is required', 400);
      }

      // Convert content to string
      const contentString = typeof body.content === 'string' 
        ? body.content 
        : JSON.stringify(body.content, null, 2);

      await store.set(blobKey, contentString);

      console.log(`[admin-blobs] Updated blob: ${storeName}/${blobKey}`);

      return createSuccessResponse({
        key: blobKey,
        updated: true,
        size: contentString.length,
      });
    }

    // DELETE - Delete blob
    if (req.method === 'DELETE') {
      if (!blobKey) {
        return createErrorResponse('Blob key is required', 400);
      }

      // Verify blob exists first
      const existing = await store.get(blobKey);
      if (existing === null) {
        return createErrorResponse('Blob not found', 404);
      }

      await store.delete(blobKey);

      console.log(`[admin-blobs] Deleted blob: ${storeName}/${blobKey}`);

      return createSuccessResponse({
        key: blobKey,
        deleted: true,
      });
    }

    // POST - Create new blob
    if (req.method === 'POST') {
      const body = await req.json() as { key: string; content: unknown };
      
      if (!body.key) {
        return createErrorResponse('Key is required', 400);
      }

      if (body.content === undefined) {
        return createErrorResponse('Content is required', 400);
      }

      // Check if blob already exists
      const existing = await store.get(body.key);
      if (existing !== null) {
        return createErrorResponse('Blob already exists. Use PUT to update.', 409);
      }

      // Convert content to string
      const contentString = typeof body.content === 'string' 
        ? body.content 
        : JSON.stringify(body.content, null, 2);

      await store.set(body.key, contentString);

      console.log(`[admin-blobs] Created blob: ${storeName}/${body.key}`);

      return createSuccessResponse({
        key: body.key,
        created: true,
        size: contentString.length,
      });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('[admin-blobs] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(`Blob operation failed: ${errorMessage}`, 500);
  }
}
