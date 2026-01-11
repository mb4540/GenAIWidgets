import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { neon } from '@neondatabase/serverless';
import { v4 as uuid } from 'uuid';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

const EXTRACTION_VERSION = '2026-01-10';
const MODEL_VERSION = 'gemini-2.5-pro-preview';

interface BlobInventoryRow {
  blob_id: string;
  tenant_id: string;
  source_store: string;
  blob_key: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: string;
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
  
  if (!context.isAdmin) {
    return createErrorResponse('Admin access required', 403);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  try {
    const body = await req.json() as { blobId?: string; processAll?: boolean };
    const { blobId, processAll } = body;

    if (!blobId && !processAll) {
      return createErrorResponse('Either blobId or processAll is required', 400);
    }

    const correlationId = uuid();
    let jobsCreated = 0;

    if (blobId) {
      const blobs = await sql`
        SELECT * FROM blob_inventory
        WHERE blob_id = ${blobId}
      ` as BlobInventoryRow[];

      const blob = blobs[0];
      if (!blob) {
        return createErrorResponse('Blob not found in inventory', 404);
      }
      
      // Allow re-extraction of any status except currently processing
      if (blob.status === 'processing') {
        return createErrorResponse('Extraction already in progress', 409);
      }

      await sql`
        UPDATE blob_inventory SET status = 'processing' WHERE blob_id = ${blobId}
      `;

      await sql`
        INSERT INTO extraction_jobs (blob_id, extraction_version, model_version, status, correlation_id)
        VALUES (${blobId}, ${EXTRACTION_VERSION}, ${MODEL_VERSION}, 'queued', ${correlationId})
      `;

      jobsCreated = 1;
    } else if (processAll) {
      const pendingBlobs = await sql`
        SELECT blob_id FROM blob_inventory
        WHERE status = 'pending'
        ORDER BY extraction_priority DESC, discovered_at ASC
        LIMIT 100
      ` as { blob_id: string }[];

      for (const blob of pendingBlobs) {
        await sql`
          UPDATE blob_inventory SET status = 'processing' WHERE blob_id = ${blob.blob_id}
        `;

        await sql`
          INSERT INTO extraction_jobs (blob_id, extraction_version, model_version, status, correlation_id)
          VALUES (${blob.blob_id}, ${EXTRACTION_VERSION}, ${MODEL_VERSION}, 'queued', ${correlationId})
        `;

        jobsCreated++;
      }
    }

    // Trigger background worker to process the jobs
    if (jobsCreated > 0) {
      const workerUrl = new URL(req.url);
      workerUrl.pathname = '/.netlify/functions/extraction-worker-background';
      
      console.log(`Triggering worker at: ${workerUrl.toString()}`);
      
      // In local dev, fire-and-forget doesn't work well, so we await the initial response
      // The worker returns 202 immediately and processes in background
      try {
        const workerResponse = await fetch(workerUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || '',
          },
          body: JSON.stringify({ processNext: true }),
        });
        console.log(`Worker trigger response: ${workerResponse.status}`);
      } catch (err) {
        console.error('Failed to trigger background worker:', err);
      }
    }

    return createSuccessResponse({
      message: `Created ${jobsCreated} extraction job(s) - processing started`,
      correlationId,
      jobsCreated,
    });
  } catch (error) {
    console.error('Error in extraction-trigger:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
