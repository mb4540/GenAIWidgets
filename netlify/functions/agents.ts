import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';
import type { Agent, AgentInput, ModelProvider } from '../../src/types/agent';

interface AgentRow {
  agent_id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  description: string | null;
  goal: string;
  system_prompt: string;
  model_provider: string;
  model_name: string;
  max_steps: number;
  temperature: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const VALID_PROVIDERS: ModelProvider[] = ['openai', 'anthropic', 'gemini'];

function isValidProvider(provider: string): provider is ModelProvider {
  return VALID_PROVIDERS.includes(provider as ModelProvider);
}

function mapRowToAgent(row: AgentRow): Agent {
  return {
    agent_id: row.agent_id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    goal: row.goal,
    system_prompt: row.system_prompt,
    model_provider: row.model_provider as ModelProvider,
    model_name: row.model_name,
    max_steps: row.max_steps,
    temperature: parseFloat(row.temperature),
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateAgentInput(body: unknown): { valid: true; data: AgentInput } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const input = body as Record<string, unknown>;

  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    return { valid: false, error: 'Agent name is required' };
  }

  if (!input.goal || typeof input.goal !== 'string' || input.goal.trim().length === 0) {
    return { valid: false, error: 'Agent goal is required' };
  }

  if (!input.system_prompt || typeof input.system_prompt !== 'string' || input.system_prompt.trim().length === 0) {
    return { valid: false, error: 'System prompt is required' };
  }

  if (!input.model_provider || typeof input.model_provider !== 'string') {
    return { valid: false, error: 'Model provider is required' };
  }

  if (!isValidProvider(input.model_provider)) {
    return { valid: false, error: `Invalid model provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` };
  }

  if (!input.model_name || typeof input.model_name !== 'string' || input.model_name.trim().length === 0) {
    return { valid: false, error: 'Model name is required' };
  }

  const maxSteps = input.max_steps !== undefined ? Number(input.max_steps) : 10;
  if (isNaN(maxSteps) || maxSteps < 1 || maxSteps > 100) {
    return { valid: false, error: 'Max steps must be between 1 and 100' };
  }

  const temperature = input.temperature !== undefined ? Number(input.temperature) : 0.7;
  if (isNaN(temperature) || temperature < 0 || temperature > 2) {
    return { valid: false, error: 'Temperature must be between 0 and 2' };
  }

  return {
    valid: true,
    data: {
      name: input.name.trim(),
      description: typeof input.description === 'string' ? input.description.trim() : undefined,
      goal: input.goal.trim(),
      system_prompt: input.system_prompt.trim(),
      model_provider: input.model_provider as ModelProvider,
      model_name: input.model_name.trim(),
      max_steps: maxSteps,
      temperature,
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
  const agentId = url.searchParams.get('id');

  try {
    // GET /api/agents - List all agents for tenant
    // GET /api/agents?id=xxx - Get single agent
    if (req.method === 'GET') {
      if (agentId) {
        // Get single agent
        const result = await sql`
          SELECT * FROM agents 
          WHERE agent_id = ${agentId} 
          AND (tenant_id = ${tenantId} OR ${isAdmin})
        ` as AgentRow[];

        const agent = result[0];
        if (!agent) {
          return createErrorResponse('Agent not found', 404);
        }

        return createSuccessResponse({ agent: mapRowToAgent(agent) });
      }

      // List all agents for tenant with tool counts
      const agents = await sql`
        SELECT a.*, 
          COALESCE(
            (SELECT json_agg(json_build_object('tool_id', t.tool_id, 'name', t.name))
             FROM agent_tool_assignments ata
             JOIN agent_tools t ON ata.tool_id = t.tool_id
             WHERE ata.agent_id = a.agent_id),
            '[]'::json
          ) as assigned_tools
        FROM agents a
        WHERE a.tenant_id = ${tenantId} OR ${isAdmin}
        ORDER BY a.name
      ` as (AgentRow & { assigned_tools: Array<{ tool_id: string; name: string }> })[];

      return createSuccessResponse({
        agents: agents.map(row => ({
          ...mapRowToAgent(row),
          assigned_tools: row.assigned_tools || [],
        })),
      });
    }

    // POST /api/agents - Create new agent
    if (req.method === 'POST') {
      if (!tenantId) {
        return createErrorResponse('Tenant context required to create agent', 400);
      }

      const body = await req.json();
      const validation = validateAgentInput(body);

      if (!validation.valid) {
        const validationError = validation as { valid: false; error: string };
        return createErrorResponse(validationError.error, 400);
      }

      const data = validation.data;

      // Check for duplicate name within tenant
      const existing = await sql`
        SELECT agent_id FROM agents 
        WHERE tenant_id = ${tenantId} AND name = ${data.name}
      `;

      if (existing.length > 0) {
        return createErrorResponse('An agent with this name already exists', 409);
      }

      const result = await sql`
        INSERT INTO agents (
          tenant_id, user_id, name, description, goal, system_prompt,
          model_provider, model_name, max_steps, temperature, is_active
        ) VALUES (
          ${tenantId}, ${userId}, ${data.name}, ${data.description || null},
          ${data.goal}, ${data.system_prompt}, ${data.model_provider},
          ${data.model_name}, ${data.max_steps}, ${data.temperature}, ${data.is_active}
        )
        RETURNING *
      ` as AgentRow[];

      const createdAgent = result[0];
      if (!createdAgent) {
        return createErrorResponse('Failed to create agent', 500);
      }

      return createSuccessResponse({ agent: mapRowToAgent(createdAgent) }, 201);
    }

    // PUT /api/agents?id=xxx - Update agent
    if (req.method === 'PUT') {
      if (!agentId) {
        return createErrorResponse('Agent ID required', 400);
      }

      // Verify agent exists and user has access
      const existingAgent = await sql`
        SELECT * FROM agents 
        WHERE agent_id = ${agentId} 
        AND (tenant_id = ${tenantId} OR ${isAdmin})
      ` as AgentRow[];

      if (existingAgent.length === 0) {
        return createErrorResponse('Agent not found', 404);
      }

      const body = await req.json();
      const validation = validateAgentInput(body);

      if (!validation.valid) {
        const validationError = validation as { valid: false; error: string };
        return createErrorResponse(validationError.error, 400);
      }

      const data = validation.data;
      const existingAgentRow = existingAgent[0];
      if (!existingAgentRow) {
        return createErrorResponse('Agent not found', 404);
      }
      const agentTenantId = existingAgentRow.tenant_id;

      // Check for duplicate name within tenant (excluding current agent)
      const duplicate = await sql`
        SELECT agent_id FROM agents 
        WHERE tenant_id = ${agentTenantId} 
        AND name = ${data.name} 
        AND agent_id != ${agentId}
      `;

      if (duplicate.length > 0) {
        return createErrorResponse('An agent with this name already exists', 409);
      }

      const result = await sql`
        UPDATE agents SET
          name = ${data.name},
          description = ${data.description || null},
          goal = ${data.goal},
          system_prompt = ${data.system_prompt},
          model_provider = ${data.model_provider},
          model_name = ${data.model_name},
          max_steps = ${data.max_steps},
          temperature = ${data.temperature},
          is_active = ${data.is_active},
          updated_at = now()
        WHERE agent_id = ${agentId}
        RETURNING *
      ` as AgentRow[];

      const updatedAgent = result[0];
      if (!updatedAgent) {
        return createErrorResponse('Failed to update agent', 500);
      }

      return createSuccessResponse({ agent: mapRowToAgent(updatedAgent) });
    }

    // DELETE /api/agents?id=xxx - Delete agent
    if (req.method === 'DELETE') {
      if (!agentId) {
        return createErrorResponse('Agent ID required', 400);
      }

      const result = await sql`
        DELETE FROM agents 
        WHERE agent_id = ${agentId} 
        AND (tenant_id = ${tenantId} OR ${isAdmin})
        RETURNING agent_id
      `;

      if (result.length === 0) {
        return createErrorResponse('Agent not found', 404);
      }

      return createSuccessResponse({ deleted: true, agentId });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error in agents:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
