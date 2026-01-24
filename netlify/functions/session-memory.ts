import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface SessionMemoryRow {
  memory_id: string;
  session_id: string;
  memory_key: string;
  memory_value: unknown;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  session_id: string;
  tenant_id: string;
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'GET') {
    return createErrorResponse('Method not allowed', 405);
  }

  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return createErrorResponse(authResult.error, authResult.status);
  }

  const { tenantId, isAdmin } = authResult.context;

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[session-memory] Missing DATABASE_URL');
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  const memoryKey = url.searchParams.get('key');

  if (!sessionId) {
    return createErrorResponse('sessionId is required', 400);
  }

  try {
    // Verify session ownership
    const sessionResult = await sql`
      SELECT session_id, tenant_id FROM agent_sessions WHERE session_id = ${sessionId}
    ` as SessionRow[];

    const session = sessionResult[0];
    if (!session) {
      return createErrorResponse('Session not found', 404);
    }

    if (session.tenant_id !== tenantId && !isAdmin) {
      return createErrorResponse('Forbidden', 403);
    }

    // Fetch memory
    if (memoryKey) {
      // Fetch specific memory key
      const result = await sql`
        SELECT * FROM agent_session_memory
        WHERE session_id = ${sessionId} AND memory_key = ${memoryKey}
      ` as SessionMemoryRow[];

      const memory = result[0];
      if (!memory) {
        return createSuccessResponse({ memory: null });
      }

      return createSuccessResponse({ memory });
    } else {
      // Fetch all memory for session
      const result = await sql`
        SELECT * FROM agent_session_memory
        WHERE session_id = ${sessionId}
        ORDER BY created_at
      ` as SessionMemoryRow[];

      return createSuccessResponse({ memories: result });
    }
  } catch (error) {
    console.error('[session-memory] Error:', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse('Internal server error', 500);
  }
}
