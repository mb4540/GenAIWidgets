import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface UpdateRequest {
  qaId: string;
  question?: string;
  answer?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

interface QAPairRow {
  qa_id: string;
  tenant_id: string;
  question: string;
  answer: string;
  status: string;
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'PATCH') {
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

  let body: UpdateRequest;
  try {
    body = (await req.json()) as UpdateRequest;
  } catch {
    return createErrorResponse('Invalid JSON body', 400);
  }

  const { qaId, question, answer, status } = body;

  if (!qaId) {
    return createErrorResponse('qaId is required', 400);
  }

  if (status && !['pending', 'approved', 'rejected'].includes(status)) {
    return createErrorResponse('Invalid status value', 400);
  }

  if (!question && !answer && !status) {
    return createErrorResponse('At least one field to update is required', 400);
  }

  try {
    // Get the Q&A pair and verify access
    const existing = await sql`
      SELECT qa_id, tenant_id, question, answer, status
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

    // Build update
    const updates: Record<string, unknown> = {};
    if (question !== undefined) updates.question = question;
    if (answer !== undefined) updates.answer = answer;
    if (status !== undefined) {
      updates.status = status;
      updates.reviewed_at = new Date().toISOString();
      updates.reviewed_by = context.userId;
    }

    // Execute update
    if (question !== undefined && answer !== undefined && status !== undefined) {
      await sql`
        UPDATE chunk_qa_pairs
        SET question = ${question}, answer = ${answer}, status = ${status},
            reviewed_at = NOW(), reviewed_by = ${context.userId}
        WHERE qa_id = ${qaId}
      `;
    } else if (question !== undefined && answer !== undefined) {
      await sql`
        UPDATE chunk_qa_pairs
        SET question = ${question}, answer = ${answer}
        WHERE qa_id = ${qaId}
      `;
    } else if (question !== undefined && status !== undefined) {
      await sql`
        UPDATE chunk_qa_pairs
        SET question = ${question}, status = ${status},
            reviewed_at = NOW(), reviewed_by = ${context.userId}
        WHERE qa_id = ${qaId}
      `;
    } else if (answer !== undefined && status !== undefined) {
      await sql`
        UPDATE chunk_qa_pairs
        SET answer = ${answer}, status = ${status},
            reviewed_at = NOW(), reviewed_by = ${context.userId}
        WHERE qa_id = ${qaId}
      `;
    } else if (question !== undefined) {
      await sql`
        UPDATE chunk_qa_pairs
        SET question = ${question}
        WHERE qa_id = ${qaId}
      `;
    } else if (answer !== undefined) {
      await sql`
        UPDATE chunk_qa_pairs
        SET answer = ${answer}
        WHERE qa_id = ${qaId}
      `;
    } else if (status !== undefined) {
      await sql`
        UPDATE chunk_qa_pairs
        SET status = ${status}, reviewed_at = NOW(), reviewed_by = ${context.userId}
        WHERE qa_id = ${qaId}
      `;
    }

    return createSuccessResponse({
      qaId,
      updated: true,
      message: 'Q&A pair updated successfully',
    });
  } catch (error) {
    console.error('Error updating Q&A pair:', error);
    return createErrorResponse('Failed to update Q&A pair', 500);
  }
}
