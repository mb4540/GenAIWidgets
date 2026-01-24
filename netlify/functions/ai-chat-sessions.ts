import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface AiChatSession {
  session_id: string;
  tenant_id: string;
  user_id: string;
  title: string | null;
  model_provider: string;
  model_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AiChatMessage {
  message_id: string;
  session_id: string;
  role: string;
  content: string;
  tokens_used: number | null;
  created_at: string;
}

interface SessionRow {
  session_id: string;
  tenant_id: string;
  user_id: string;
  title: string | null;
  model_provider: string;
  model_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  message_id: string;
  session_id: string;
  role: string;
  content: string;
  tokens_used: number | null;
  created_at: string;
}

function mapRowToSession(row: SessionRow): AiChatSession {
  return {
    session_id: row.session_id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    title: row.title,
    model_provider: row.model_provider,
    model_name: row.model_name,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapRowToMessage(row: MessageRow): AiChatMessage {
  return {
    message_id: row.message_id,
    session_id: row.session_id,
    role: row.role,
    content: row.content,
    tokens_used: row.tokens_used,
    created_at: row.created_at,
  };
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    const authError = authResult as { success: false; error: string; status: number };
    return createErrorResponse(authError.error, authError.status);
  }

  const { userId, tenantId, isAdmin } = authResult.context;

  if (!tenantId && !isAdmin) {
    return createErrorResponse('Tenant context required', 400);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('id');

  try {
    // GET - List sessions or get single session with messages
    if (req.method === 'GET') {
      if (sessionId) {
        // Get single session with messages
        const sessions = await sql`
          SELECT * FROM ai_chat_sessions 
          WHERE session_id = ${sessionId} 
          AND (tenant_id = ${tenantId} OR ${isAdmin})
        ` as SessionRow[];

        if (sessions.length === 0) {
          return createErrorResponse('Session not found', 404);
        }

        const messages = await sql`
          SELECT * FROM ai_chat_messages 
          WHERE session_id = ${sessionId}
          ORDER BY created_at ASC
        ` as MessageRow[];

        return createSuccessResponse({
          session: mapRowToSession(sessions[0]!),
          messages: messages.map(mapRowToMessage),
        });
      } else {
        // List all sessions for user
        const sessions = await sql`
          SELECT * FROM ai_chat_sessions 
          WHERE user_id = ${userId}
          AND (tenant_id = ${tenantId} OR ${isAdmin})
          ORDER BY created_at DESC
        ` as SessionRow[];

        return createSuccessResponse({
          sessions: sessions.map(mapRowToSession),
        });
      }
    }

    // POST - Create new session
    if (req.method === 'POST') {
      const body = await req.json() as { 
        model_provider: string; 
        model_name: string;
        title?: string;
      };

      if (!body.model_provider || !body.model_name) {
        return createErrorResponse('model_provider and model_name are required', 400);
      }

      const result = await sql`
        INSERT INTO ai_chat_sessions (tenant_id, user_id, model_provider, model_name, title)
        VALUES (${tenantId}, ${userId}, ${body.model_provider}, ${body.model_name}, ${body.title || null})
        RETURNING *
      ` as SessionRow[];

      return createSuccessResponse({
        session: mapRowToSession(result[0]!),
      });
    }

    // PUT - Update session (title, status)
    if (req.method === 'PUT') {
      if (!sessionId) {
        return createErrorResponse('Session ID required', 400);
      }

      const body = await req.json() as { 
        title?: string;
        status?: string;
        model_provider?: string;
        model_name?: string;
      };

      // Verify ownership
      const existing = await sql`
        SELECT * FROM ai_chat_sessions 
        WHERE session_id = ${sessionId} 
        AND (tenant_id = ${tenantId} OR ${isAdmin})
      ` as SessionRow[];

      if (existing.length === 0) {
        return createErrorResponse('Session not found', 404);
      }

      const updates: string[] = [];
      const values: unknown[] = [];

      if (body.title !== undefined) {
        updates.push('title');
        values.push(body.title);
      }
      if (body.status !== undefined) {
        updates.push('status');
        values.push(body.status);
      }
      if (body.model_provider !== undefined) {
        updates.push('model_provider');
        values.push(body.model_provider);
      }
      if (body.model_name !== undefined) {
        updates.push('model_name');
        values.push(body.model_name);
      }

      if (updates.length === 0) {
        return createSuccessResponse({ session: mapRowToSession(existing[0]!) });
      }

      // Build dynamic update - simplified approach
      const result = await sql`
        UPDATE ai_chat_sessions 
        SET 
          title = COALESCE(${body.title}, title),
          status = COALESCE(${body.status}, status),
          model_provider = COALESCE(${body.model_provider}, model_provider),
          model_name = COALESCE(${body.model_name}, model_name)
        WHERE session_id = ${sessionId}
        RETURNING *
      ` as SessionRow[];

      return createSuccessResponse({
        session: mapRowToSession(result[0]!),
      });
    }

    // DELETE - Delete session
    if (req.method === 'DELETE') {
      if (!sessionId) {
        return createErrorResponse('Session ID required', 400);
      }

      // Verify ownership
      const existing = await sql`
        SELECT * FROM ai_chat_sessions 
        WHERE session_id = ${sessionId} 
        AND (tenant_id = ${tenantId} OR ${isAdmin})
      ` as SessionRow[];

      if (existing.length === 0) {
        return createErrorResponse('Session not found', 404);
      }

      await sql`DELETE FROM ai_chat_sessions WHERE session_id = ${sessionId}`;

      return createSuccessResponse({ deleted: true });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('[ai-chat-sessions] Error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
