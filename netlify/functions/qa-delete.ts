import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface QAPairRow {
  qa_id: string;
  tenant_id: string;
  status: string;
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

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);
  const url = new URL(req.url);
  const qaId = url.searchParams.get('qaId');

  if (!qaId) {
    return createErrorResponse('qaId parameter is required', 400);
  }

  try {
    // Get the Q&A pair and verify access
    const existing = await sql`
      SELECT qa_id, tenant_id, status
      FROM chunk_qa_pairs
      WHERE qa_id = ${qaId}
    ` as QAPairRow[];

    if (!existing[0]) {
      return createErrorResponse('Q&A pair not found', 404);
    }

    const qaPair = existing[0];

    // Verify tenant access
    if (!context.isAdmin && qaPair.tenant_id !== context.tenantId) {
      return createErrorResponse('Forbidden', 403);
    }

    // Delete the Q&A pair
    await sql`
      DELETE FROM chunk_qa_pairs
      WHERE qa_id = ${qaId}
    `;

    return createSuccessResponse({
      qaId,
      deleted: true,
      message: 'Q&A pair deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting Q&A pair:', error);
    return createErrorResponse('Failed to delete Q&A pair', 500);
  }
}
