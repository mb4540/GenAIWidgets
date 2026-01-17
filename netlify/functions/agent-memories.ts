import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';
import type { AgentMemory, MemoryInput, MemoryType } from '../../src/types/agent';

interface MemoryRow {
  memory_id: string;
  agent_id: string;
  tenant_id: string;
  memory_type: string;
  content: string;
  source_session_id: string | null;
  importance: number;
  last_accessed_at: string | null;
  access_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const VALID_MEMORY_TYPES: MemoryType[] = ['fact', 'preference', 'learned', 'user_provided'];

function isValidMemoryType(type: string): type is MemoryType {
  return VALID_MEMORY_TYPES.includes(type as MemoryType);
}

function mapRowToMemory(row: MemoryRow): AgentMemory {
  return {
    memory_id: row.memory_id,
    agent_id: row.agent_id,
    tenant_id: row.tenant_id,
    memory_type: row.memory_type as MemoryType,
    content: row.content,
    source_session_id: row.source_session_id,
    importance: row.importance,
    last_accessed_at: row.last_accessed_at,
    access_count: row.access_count,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateMemoryInput(body: unknown): { valid: true; data: MemoryInput } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const input = body as Record<string, unknown>;

  if (!input.content || typeof input.content !== 'string' || input.content.trim().length === 0) {
    return { valid: false, error: 'Memory content is required' };
  }

  const memoryType = (input.memory_type as string) || 'user_provided';
  if (!isValidMemoryType(memoryType)) {
    return { valid: false, error: `Invalid memory type. Must be one of: ${VALID_MEMORY_TYPES.join(', ')}` };
  }

  const importance = input.importance !== undefined ? Number(input.importance) : 5;
  if (isNaN(importance) || importance < 1 || importance > 10) {
    return { valid: false, error: 'Importance must be between 1 and 10' };
  }

  return {
    valid: true,
    data: {
      content: input.content.trim(),
      memory_type: memoryType,
      importance,
      is_active: input.is_active !== false,
    },
  };
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    const authError = authResult as { success: false; error: string; status: number };
    return createErrorResponse(authError.error, authError.status);
  }

  const { tenantId, isAdmin } = authResult.context;

  if (!tenantId && !isAdmin) {
    return createErrorResponse('Tenant context required', 400);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);
  const url = new URL(req.url);
  const memoryId = url.searchParams.get('id');
  const agentId = url.searchParams.get('agentId');
  const memoryType = url.searchParams.get('type');

  try {
    // GET /api/agent-memories?agentId=xxx - List memories for an agent
    // GET /api/agent-memories?id=xxx - Get single memory
    if (req.method === 'GET') {
      if (memoryId) {
        const result = await sql`
          SELECT * FROM agent_long_term_memory 
          WHERE memory_id = ${memoryId} 
          AND (tenant_id = ${tenantId} OR ${isAdmin})
        ` as MemoryRow[];

        const memory = result[0];
        if (!memory) {
          return createErrorResponse('Memory not found', 404);
        }

        // Update access tracking
        await sql`
          UPDATE agent_long_term_memory 
          SET last_accessed_at = now(), access_count = access_count + 1
          WHERE memory_id = ${memoryId}
        `;

        return createSuccessResponse({ memory: mapRowToMemory(memory) });
      }

      if (agentId) {
        // Build query based on filters
        let memories: MemoryRow[];
        
        if (memoryType && isValidMemoryType(memoryType)) {
          memories = await sql`
            SELECT * FROM agent_long_term_memory 
            WHERE agent_id = ${agentId} 
            AND (tenant_id = ${tenantId} OR ${isAdmin})
            AND memory_type = ${memoryType}
            AND is_active = true
            ORDER BY importance DESC, created_at DESC
          ` as MemoryRow[];
        } else {
          memories = await sql`
            SELECT * FROM agent_long_term_memory 
            WHERE agent_id = ${agentId} 
            AND (tenant_id = ${tenantId} OR ${isAdmin})
            AND is_active = true
            ORDER BY importance DESC, created_at DESC
          ` as MemoryRow[];
        }

        return createSuccessResponse({ memories: memories.map(mapRowToMemory) });
      }

      return createErrorResponse('Agent ID is required', 400);
    }

    // POST /api/agent-memories?agentId=xxx - Add memory to agent
    if (req.method === 'POST') {
      if (!agentId) {
        return createErrorResponse('Agent ID is required', 400);
      }

      if (!tenantId) {
        return createErrorResponse('Tenant context required to create memory', 400);
      }

      // Verify agent exists and belongs to tenant
      const agentCheck = await sql`
        SELECT agent_id FROM agents 
        WHERE agent_id = ${agentId} 
        AND (tenant_id = ${tenantId} OR ${isAdmin})
      `;

      if (agentCheck.length === 0) {
        return createErrorResponse('Agent not found', 404);
      }

      const body = await req.json();
      const validation = validateMemoryInput(body);

      if (!validation.valid) {
        const validationError = validation as { valid: false; error: string };
        return createErrorResponse(validationError.error, 400);
      }

      const data = validation.data;
      const sourceSessionId = (body as Record<string, unknown>).source_session_id as string | undefined;

      const result = await sql`
        INSERT INTO agent_long_term_memory (
          agent_id, tenant_id, memory_type, content, source_session_id, importance, is_active
        ) VALUES (
          ${agentId}, ${tenantId}, ${data.memory_type}, ${data.content},
          ${sourceSessionId || null}, ${data.importance}, ${data.is_active}
        )
        RETURNING *
      ` as MemoryRow[];

      const createdMemory = result[0];
      if (!createdMemory) {
        return createErrorResponse('Failed to create memory', 500);
      }

      return createSuccessResponse({ memory: mapRowToMemory(createdMemory) }, 201);
    }

    // PUT /api/agent-memories?id=xxx - Update memory
    if (req.method === 'PUT') {
      if (!memoryId) {
        return createErrorResponse('Memory ID required', 400);
      }

      const existingMemory = await sql`
        SELECT * FROM agent_long_term_memory 
        WHERE memory_id = ${memoryId} 
        AND (tenant_id = ${tenantId} OR ${isAdmin})
      ` as MemoryRow[];

      if (existingMemory.length === 0) {
        return createErrorResponse('Memory not found', 404);
      }

      const body = await req.json();
      const validation = validateMemoryInput(body);

      if (!validation.valid) {
        const validationError = validation as { valid: false; error: string };
        return createErrorResponse(validationError.error, 400);
      }

      const data = validation.data;

      const result = await sql`
        UPDATE agent_long_term_memory SET
          content = ${data.content},
          memory_type = ${data.memory_type},
          importance = ${data.importance},
          is_active = ${data.is_active},
          updated_at = now()
        WHERE memory_id = ${memoryId}
        RETURNING *
      ` as MemoryRow[];

      const updatedMemory = result[0];
      if (!updatedMemory) {
        return createErrorResponse('Failed to update memory', 500);
      }

      return createSuccessResponse({ memory: mapRowToMemory(updatedMemory) });
    }

    // DELETE /api/agent-memories?id=xxx - Delete memory
    if (req.method === 'DELETE') {
      if (!memoryId) {
        return createErrorResponse('Memory ID required', 400);
      }

      const result = await sql`
        DELETE FROM agent_long_term_memory 
        WHERE memory_id = ${memoryId} 
        AND (tenant_id = ${tenantId} OR ${isAdmin})
        RETURNING memory_id
      `;

      if (result.length === 0) {
        return createErrorResponse('Memory not found', 404);
      }

      return createSuccessResponse({ deleted: true, memoryId });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error in agent-memories:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
