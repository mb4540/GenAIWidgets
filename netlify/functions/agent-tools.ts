import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';
import type { AgentTool, ToolInput, ToolType, ToolAssignment } from '../../src/types/agent';

interface ToolRow {
  tool_id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  description: string;
  tool_type: string;
  input_schema: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AssignmentRow {
  assignment_id: string;
  agent_id: string;
  tool_id: string;
  is_required: boolean;
  created_at: string;
}

const VALID_TOOL_TYPES: ToolType[] = ['mcp_server', 'python_script'];

function isValidToolType(type: string): type is ToolType {
  return VALID_TOOL_TYPES.includes(type as ToolType);
}

function mapRowToTool(row: ToolRow): AgentTool {
  return {
    tool_id: row.tool_id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    tool_type: row.tool_type as ToolType,
    input_schema: row.input_schema,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapRowToAssignment(row: AssignmentRow): ToolAssignment {
  return {
    assignment_id: row.assignment_id,
    agent_id: row.agent_id,
    tool_id: row.tool_id,
    is_required: row.is_required,
    created_at: row.created_at,
  };
}

function validateToolInput(body: unknown): { valid: true; data: ToolInput } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const input = body as Record<string, unknown>;

  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    return { valid: false, error: 'Tool name is required' };
  }

  if (!input.description || typeof input.description !== 'string' || input.description.trim().length === 0) {
    return { valid: false, error: 'Tool description is required' };
  }

  if (!input.tool_type || typeof input.tool_type !== 'string') {
    return { valid: false, error: 'Tool type is required' };
  }

  if (!isValidToolType(input.tool_type)) {
    return { valid: false, error: `Invalid tool type. Must be one of: ${VALID_TOOL_TYPES.join(', ')}` };
  }

  if (!input.input_schema || typeof input.input_schema !== 'object') {
    return { valid: false, error: 'Input schema is required and must be an object' };
  }

  return {
    valid: true,
    data: {
      name: input.name.trim(),
      description: input.description.trim(),
      tool_type: input.tool_type as ToolType,
      input_schema: input.input_schema as Record<string, unknown>,
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
  const toolId = url.searchParams.get('id') || url.searchParams.get('toolId');
  const agentId = url.searchParams.get('agentId');
  const action = url.searchParams.get('action');

  try {
    // Handle tool assignments
    if (action === 'assign' && agentId && toolId) {
      if (req.method === 'POST') {
        // Assign tool to agent
        let isRequired = false;
        try {
          const body = await req.json() as { is_required?: boolean };
          isRequired = body.is_required ?? false;
        } catch {
          // Body may be empty, use default
        }

        // Verify agent exists and belongs to tenant
        const agentCheck = await sql`
          SELECT agent_id FROM agents 
          WHERE agent_id = ${agentId} AND (tenant_id = ${tenantId} OR ${isAdmin})
        `;
        if (agentCheck.length === 0) {
          return createErrorResponse('Agent not found', 404);
        }

        // Verify tool exists and belongs to tenant
        const toolCheck = await sql`
          SELECT tool_id FROM agent_tools 
          WHERE tool_id = ${toolId} AND (tenant_id = ${tenantId} OR ${isAdmin})
        `;
        if (toolCheck.length === 0) {
          return createErrorResponse('Tool not found', 404);
        }

        // Check if already assigned
        const existing = await sql`
          SELECT assignment_id FROM agent_tool_assignments 
          WHERE agent_id = ${agentId} AND tool_id = ${toolId}
        `;
        if (existing.length > 0) {
          return createErrorResponse('Tool already assigned to this agent', 409);
        }

        const result = await sql`
          INSERT INTO agent_tool_assignments (agent_id, tool_id, is_required)
          VALUES (${agentId}, ${toolId}, ${isRequired})
          RETURNING *
        ` as AssignmentRow[];

        const assignment = result[0];
        if (!assignment) {
          return createErrorResponse('Failed to assign tool', 500);
        }

        return createSuccessResponse({ assignment: mapRowToAssignment(assignment) }, 201);
      }

      if (req.method === 'DELETE') {
        // Unassign tool from agent
        const result = await sql`
          DELETE FROM agent_tool_assignments 
          WHERE agent_id = ${agentId} AND tool_id = ${toolId}
          RETURNING assignment_id
        `;

        if (result.length === 0) {
          return createErrorResponse('Assignment not found', 404);
        }

        return createSuccessResponse({ deleted: true });
      }

      return createErrorResponse('Method not allowed for assign action', 405);
    }

    // Get tools assigned to an agent
    if (action === 'assigned' && agentId) {
      const tools = await sql`
        SELECT t.* FROM agent_tools t
        JOIN agent_tool_assignments a ON t.tool_id = a.tool_id
        WHERE a.agent_id = ${agentId} AND (t.tenant_id = ${tenantId} OR ${isAdmin})
      ` as ToolRow[];

      return createSuccessResponse({ tools: tools.map(mapRowToTool) });
    }

    // Get agents that a tool is assigned to
    if (action === 'assignments' && toolId) {
      const agents = await sql`
        SELECT a.agent_id FROM agent_tool_assignments a
        JOIN agent_tools t ON a.tool_id = t.tool_id
        WHERE a.tool_id = ${toolId} AND (t.tenant_id = ${tenantId} OR ${isAdmin})
      ` as Array<{ agent_id: string }>;

      return createSuccessResponse({ agents });
    }

    // GET /api/agent-tools - List all tools
    // GET /api/agent-tools?id=xxx - Get single tool
    if (req.method === 'GET') {
      if (toolId) {
        const result = await sql`
          SELECT * FROM agent_tools 
          WHERE tool_id = ${toolId} AND (tenant_id = ${tenantId} OR ${isAdmin})
        ` as ToolRow[];

        const tool = result[0];
        if (!tool) {
          return createErrorResponse('Tool not found', 404);
        }

        return createSuccessResponse({ tool: mapRowToTool(tool) });
      }

      const tools = await sql`
        SELECT * FROM agent_tools 
        WHERE tenant_id = ${tenantId} OR ${isAdmin}
        ORDER BY name
      ` as ToolRow[];

      return createSuccessResponse({ tools: tools.map(mapRowToTool) });
    }

    // POST /api/agent-tools - Create new tool
    if (req.method === 'POST') {
      if (!tenantId) {
        return createErrorResponse('Tenant context required to create tool', 400);
      }

      const body = await req.json();
      const validation = validateToolInput(body);

      if (!validation.valid) {
        const validationError = validation as { valid: false; error: string };
        return createErrorResponse(validationError.error, 400);
      }

      const data = validation.data;

      // Check for duplicate name within tenant
      const existing = await sql`
        SELECT tool_id FROM agent_tools 
        WHERE tenant_id = ${tenantId} AND name = ${data.name}
      `;

      if (existing.length > 0) {
        return createErrorResponse('A tool with this name already exists', 409);
      }

      const result = await sql`
        INSERT INTO agent_tools (
          tenant_id, user_id, name, description, tool_type, input_schema, is_active
        ) VALUES (
          ${tenantId}, ${userId}, ${data.name}, ${data.description},
          ${data.tool_type}, ${JSON.stringify(data.input_schema)}, ${data.is_active}
        )
        RETURNING *
      ` as ToolRow[];

      const createdTool = result[0];
      if (!createdTool) {
        return createErrorResponse('Failed to create tool', 500);
      }

      return createSuccessResponse({ tool: mapRowToTool(createdTool) }, 201);
    }

    // PUT /api/agent-tools?id=xxx - Update tool
    if (req.method === 'PUT') {
      if (!toolId) {
        return createErrorResponse('Tool ID required', 400);
      }

      const existingTool = await sql`
        SELECT * FROM agent_tools 
        WHERE tool_id = ${toolId} AND (tenant_id = ${tenantId} OR ${isAdmin})
      ` as ToolRow[];

      if (existingTool.length === 0) {
        return createErrorResponse('Tool not found', 404);
      }

      const body = await req.json();
      const validation = validateToolInput(body);

      if (!validation.valid) {
        const validationError = validation as { valid: false; error: string };
        return createErrorResponse(validationError.error, 400);
      }

      const data = validation.data;
      const existingToolRow = existingTool[0];
      if (!existingToolRow) {
        return createErrorResponse('Tool not found', 404);
      }
      const toolTenantId = existingToolRow.tenant_id;

      // Check for duplicate name within tenant (excluding current tool)
      const duplicate = await sql`
        SELECT tool_id FROM agent_tools 
        WHERE tenant_id = ${toolTenantId} AND name = ${data.name} AND tool_id != ${toolId}
      `;

      if (duplicate.length > 0) {
        return createErrorResponse('A tool with this name already exists', 409);
      }

      const result = await sql`
        UPDATE agent_tools SET
          name = ${data.name},
          description = ${data.description},
          tool_type = ${data.tool_type},
          input_schema = ${JSON.stringify(data.input_schema)},
          is_active = ${data.is_active},
          updated_at = now()
        WHERE tool_id = ${toolId}
        RETURNING *
      ` as ToolRow[];

      const updatedTool = result[0];
      if (!updatedTool) {
        return createErrorResponse('Failed to update tool', 500);
      }

      return createSuccessResponse({ tool: mapRowToTool(updatedTool) });
    }

    // DELETE /api/agent-tools?id=xxx - Delete tool
    if (req.method === 'DELETE') {
      if (!toolId) {
        return createErrorResponse('Tool ID required', 400);
      }

      const result = await sql`
        DELETE FROM agent_tools 
        WHERE tool_id = ${toolId} AND (tenant_id = ${tenantId} OR ${isAdmin})
        RETURNING tool_id
      `;

      if (result.length === 0) {
        return createErrorResponse('Tool not found', 404);
      }

      return createSuccessResponse({ deleted: true, toolId });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error in agent-tools:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
