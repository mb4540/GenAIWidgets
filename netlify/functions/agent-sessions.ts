import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';
import type { AgentSession, SessionMessage, SessionStatus, MessageRole } from '../../src/types/agent';

interface SessionRow {
  session_id: string;
  agent_id: string;
  user_id: string;
  tenant_id: string;
  title: string | null;
  status: string;
  current_step: number;
  goal_met: boolean;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

interface MessageRow {
  message_id: string;
  session_id: string;
  step_number: number;
  role: string;
  content: string;
  tool_name: string | null;
  tool_input: Record<string, unknown> | null;
  tool_output: Record<string, unknown> | null;
  reasoning: string | null;
  tokens_used: number | null;
  created_at: string;
}

function mapRowToSession(row: SessionRow): AgentSession {
  return {
    session_id: row.session_id,
    agent_id: row.agent_id,
    user_id: row.user_id,
    tenant_id: row.tenant_id,
    title: row.title,
    status: row.status as SessionStatus,
    current_step: row.current_step,
    goal_met: row.goal_met,
    started_at: row.started_at,
    ended_at: row.ended_at,
    created_at: row.created_at,
  };
}

function mapRowToMessage(row: MessageRow): SessionMessage {
  return {
    message_id: row.message_id,
    session_id: row.session_id,
    step_number: row.step_number,
    role: row.role as MessageRole,
    content: row.content,
    tool_name: row.tool_name,
    tool_input: row.tool_input,
    tool_output: row.tool_output,
    reasoning: row.reasoning,
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
  const agentId = url.searchParams.get('agentId');
  const action = url.searchParams.get('action');

  try {
    // Cancel session action
    if (action === 'cancel' && sessionId && req.method === 'POST') {
      const session = await sql`
        SELECT * FROM agent_sessions 
        WHERE session_id = ${sessionId} 
        AND (tenant_id = ${tenantId} OR ${isAdmin})
        AND status = 'active'
      ` as SessionRow[];

      if (session.length === 0) {
        return createErrorResponse('Active session not found', 404);
      }

      const result = await sql`
        UPDATE agent_sessions 
        SET status = 'cancelled', ended_at = now()
        WHERE session_id = ${sessionId}
        RETURNING *
      ` as SessionRow[];

      const updatedSession = result[0];
      if (!updatedSession) {
        return createErrorResponse('Failed to cancel session', 500);
      }

      return createSuccessResponse({ session: mapRowToSession(updatedSession) });
    }

    // Get session status (for polling)
    if (action === 'status' && sessionId && req.method === 'GET') {
      const session = await sql`
        SELECT * FROM agent_sessions 
        WHERE session_id = ${sessionId} 
        AND (tenant_id = ${tenantId} OR ${isAdmin})
      ` as SessionRow[];

      if (session.length === 0) {
        return createErrorResponse('Session not found', 404);
      }

      const sessionRow = session[0];
      if (!sessionRow) {
        return createErrorResponse('Session not found', 404);
      }

      return createSuccessResponse({
        status: sessionRow.status,
        current_step: sessionRow.current_step,
        goal_met: sessionRow.goal_met,
      });
    }

    // GET /api/agent-sessions?agentId=xxx - List sessions for an agent
    // GET /api/agent-sessions?id=xxx - Get single session with messages
    if (req.method === 'GET') {
      if (sessionId) {
        // Get session with messages
        const sessionResult = await sql`
          SELECT * FROM agent_sessions 
          WHERE session_id = ${sessionId} 
          AND (tenant_id = ${tenantId} OR ${isAdmin})
        ` as SessionRow[];

        const session = sessionResult[0];
        if (!session) {
          return createErrorResponse('Session not found', 404);
        }

        const messages = await sql`
          SELECT * FROM agent_session_messages 
          WHERE session_id = ${sessionId}
          ORDER BY step_number, created_at
        ` as MessageRow[];

        return createSuccessResponse({
          session: mapRowToSession(session),
          messages: messages.map(mapRowToMessage),
        });
      }

      if (agentId) {
        // List sessions for agent
        const sessions = await sql`
          SELECT * FROM agent_sessions 
          WHERE agent_id = ${agentId} 
          AND (tenant_id = ${tenantId} OR ${isAdmin})
          ORDER BY created_at DESC
        ` as SessionRow[];

        return createSuccessResponse({ sessions: sessions.map(mapRowToSession) });
      }

      // List all sessions for tenant
      const sessions = await sql`
        SELECT * FROM agent_sessions 
        WHERE tenant_id = ${tenantId} OR ${isAdmin}
        ORDER BY created_at DESC
        LIMIT 100
      ` as SessionRow[];

      return createSuccessResponse({ sessions: sessions.map(mapRowToSession) });
    }

    // POST /api/agent-sessions?agentId=xxx - Start new session
    if (req.method === 'POST') {
      if (!agentId) {
        return createErrorResponse('Agent ID is required', 400);
      }

      if (!tenantId) {
        return createErrorResponse('Tenant context required to create session', 400);
      }

      // Verify agent exists and belongs to tenant
      const agentCheck = await sql`
        SELECT agent_id, name FROM agents 
        WHERE agent_id = ${agentId} 
        AND (tenant_id = ${tenantId} OR ${isAdmin})
        AND is_active = true
      ` as { agent_id: string; name: string }[];

      if (agentCheck.length === 0) {
        return createErrorResponse('Agent not found or inactive', 404);
      }

      const body = await req.json().catch(() => ({})) as { title?: string };
      const title = body.title || `Session with ${agentCheck[0]?.name || 'Agent'}`;

      const result = await sql`
        INSERT INTO agent_sessions (agent_id, user_id, tenant_id, title)
        VALUES (${agentId}, ${userId}, ${tenantId}, ${title})
        RETURNING *
      ` as SessionRow[];

      const createdSession = result[0];
      if (!createdSession) {
        return createErrorResponse('Failed to create session', 500);
      }

      return createSuccessResponse({ session: mapRowToSession(createdSession) }, 201);
    }

    // DELETE /api/agent-sessions?id=xxx - Delete session
    if (req.method === 'DELETE') {
      if (!sessionId) {
        return createErrorResponse('Session ID required', 400);
      }

      const result = await sql`
        DELETE FROM agent_sessions 
        WHERE session_id = ${sessionId} 
        AND (tenant_id = ${tenantId} OR ${isAdmin})
        RETURNING session_id
      `;

      if (result.length === 0) {
        return createErrorResponse('Session not found', 404);
      }

      return createSuccessResponse({ deleted: true, sessionId });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error in agent-sessions:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
