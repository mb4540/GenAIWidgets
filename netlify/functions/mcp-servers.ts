import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';
import { encryptCredentials, isEncryptionConfigured } from './lib/encryption';
import type { McpServer, McpServerInput, McpAuthType, McpHealthStatus } from '../../src/types/agent';

interface McpServerRow {
  mcp_server_id: string;
  tool_id: string;
  tenant_id: string;
  server_name: string;
  server_url: string;
  auth_type: string;
  auth_config: Record<string, unknown> | null;
  health_status: string;
  last_health_check: string | null;
  created_at: string;
  updated_at: string;
}

const VALID_AUTH_TYPES: McpAuthType[] = ['none', 'api_key', 'bearer', 'basic'];

function isValidAuthType(type: string): type is McpAuthType {
  return VALID_AUTH_TYPES.includes(type as McpAuthType);
}

function mapRowToMcpServer(row: McpServerRow): McpServer {
  return {
    mcp_server_id: row.mcp_server_id,
    tool_id: row.tool_id,
    tenant_id: row.tenant_id,
    server_name: row.server_name,
    server_url: row.server_url,
    auth_type: row.auth_type as McpAuthType,
    auth_config: null, // Never expose auth_config to client
    health_status: row.health_status as McpHealthStatus,
    last_health_check: row.last_health_check,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateMcpServerInput(body: unknown): { valid: true; data: McpServerInput } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const input = body as Record<string, unknown>;

  if (!input.server_name || typeof input.server_name !== 'string' || input.server_name.trim().length === 0) {
    return { valid: false, error: 'Server name is required' };
  }

  if (!input.server_url || typeof input.server_url !== 'string' || input.server_url.trim().length === 0) {
    return { valid: false, error: 'Server URL is required' };
  }

  // Validate URL format
  try {
    new URL(input.server_url);
  } catch {
    return { valid: false, error: 'Invalid server URL format' };
  }

  const authType = (input.auth_type as string) || 'none';
  if (!isValidAuthType(authType)) {
    return { valid: false, error: `Invalid auth type. Must be one of: ${VALID_AUTH_TYPES.join(', ')}` };
  }

  // Validate auth credentials based on auth type
  const credentials = input.auth_credentials as Record<string, unknown> | undefined;
  if (authType !== 'none' && !credentials) {
    return { valid: false, error: 'Auth credentials required for non-none auth type' };
  }

  if (authType === 'api_key' && (!credentials?.api_key || typeof credentials.api_key !== 'string')) {
    return { valid: false, error: 'API key is required for api_key auth type' };
  }

  if (authType === 'bearer' && (!credentials?.bearer_token || typeof credentials.bearer_token !== 'string')) {
    return { valid: false, error: 'Bearer token is required for bearer auth type' };
  }

  if (authType === 'basic') {
    if (!credentials?.username || typeof credentials.username !== 'string') {
      return { valid: false, error: 'Username is required for basic auth type' };
    }
    if (!credentials?.password || typeof credentials.password !== 'string') {
      return { valid: false, error: 'Password is required for basic auth type' };
    }
  }

  return {
    valid: true,
    data: {
      server_name: input.server_name.trim(),
      server_url: input.server_url.trim(),
      auth_type: authType,
      auth_credentials: credentials,
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
  const serverId = url.searchParams.get('id');
  const toolId = url.searchParams.get('toolId');
  const action = url.searchParams.get('action');

  try {
    // Health check action
    if (action === 'health' && serverId) {
      const server = await sql`
        SELECT * FROM mcp_servers 
        WHERE mcp_server_id = ${serverId} AND (tenant_id = ${tenantId} OR ${isAdmin})
      ` as McpServerRow[];

      if (server.length === 0) {
        return createErrorResponse('MCP server not found', 404);
      }

      const serverRow = server[0];
      if (!serverRow) {
        return createErrorResponse('MCP server not found', 404);
      }

      // Perform health check
      let healthStatus: McpHealthStatus = 'unhealthy';
      try {
        const healthResponse = await fetch(`${serverRow.server_url}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        healthStatus = healthResponse.ok ? 'healthy' : 'unhealthy';
      } catch {
        healthStatus = 'unhealthy';
      }

      // Update health status in database
      await sql`
        UPDATE mcp_servers 
        SET health_status = ${healthStatus}, last_health_check = now(), updated_at = now()
        WHERE mcp_server_id = ${serverId}
      `;

      return createSuccessResponse({ 
        health_status: healthStatus,
        last_health_check: new Date().toISOString(),
      });
    }

    // GET /api/mcp-servers - List all MCP servers
    // GET /api/mcp-servers?id=xxx - Get single server
    // GET /api/mcp-servers?toolId=xxx - Get server for a tool
    if (req.method === 'GET') {
      if (serverId) {
        const result = await sql`
          SELECT * FROM mcp_servers 
          WHERE mcp_server_id = ${serverId} AND (tenant_id = ${tenantId} OR ${isAdmin})
        ` as McpServerRow[];

        const server = result[0];
        if (!server) {
          return createErrorResponse('MCP server not found', 404);
        }

        return createSuccessResponse({ server: mapRowToMcpServer(server) });
      }

      if (toolId) {
        const result = await sql`
          SELECT * FROM mcp_servers 
          WHERE tool_id = ${toolId} AND (tenant_id = ${tenantId} OR ${isAdmin})
        ` as McpServerRow[];

        const server = result[0];
        if (!server) {
          return createErrorResponse('MCP server not found for this tool', 404);
        }

        return createSuccessResponse({ server: mapRowToMcpServer(server) });
      }

      const servers = await sql`
        SELECT * FROM mcp_servers 
        WHERE tenant_id = ${tenantId} OR ${isAdmin}
        ORDER BY server_name
      ` as McpServerRow[];

      return createSuccessResponse({ servers: servers.map(mapRowToMcpServer) });
    }

    // POST /api/mcp-servers?toolId=xxx - Create new MCP server for a tool
    if (req.method === 'POST') {
      if (!tenantId) {
        return createErrorResponse('Tenant context required to create MCP server', 400);
      }

      if (!toolId) {
        return createErrorResponse('Tool ID is required', 400);
      }

      // Verify tool exists and belongs to tenant
      const toolCheck = await sql`
        SELECT tool_id, tool_type FROM agent_tools 
        WHERE tool_id = ${toolId} AND (tenant_id = ${tenantId} OR ${isAdmin})
      ` as { tool_id: string; tool_type: string }[];

      if (toolCheck.length === 0) {
        return createErrorResponse('Tool not found', 404);
      }

      const tool = toolCheck[0];
      if (!tool || tool.tool_type !== 'mcp_server') {
        return createErrorResponse('Tool must be of type mcp_server', 400);
      }

      // Check if MCP server already exists for this tool
      const existing = await sql`
        SELECT mcp_server_id FROM mcp_servers WHERE tool_id = ${toolId}
      `;
      if (existing.length > 0) {
        return createErrorResponse('MCP server already exists for this tool', 409);
      }

      const body = await req.json();
      const validation = validateMcpServerInput(body);

      if (!validation.valid) {
        const validationError = validation as { valid: false; error: string };
        return createErrorResponse(validationError.error, 400);
      }

      const data = validation.data;

      // Encrypt credentials if provided
      let authConfig: Record<string, unknown> | null = null;
      if (data.auth_type !== 'none' && data.auth_credentials) {
        if (!isEncryptionConfigured()) {
          return createErrorResponse('Encryption not configured. Cannot store credentials.', 500);
        }
        authConfig = encryptCredentials(data.auth_credentials);
      }

      const result = await sql`
        INSERT INTO mcp_servers (
          tool_id, tenant_id, server_name, server_url, auth_type, auth_config
        ) VALUES (
          ${toolId}, ${tenantId}, ${data.server_name}, ${data.server_url},
          ${data.auth_type}, ${authConfig ? JSON.stringify(authConfig) : null}
        )
        RETURNING *
      ` as McpServerRow[];

      const createdServer = result[0];
      if (!createdServer) {
        return createErrorResponse('Failed to create MCP server', 500);
      }

      return createSuccessResponse({ server: mapRowToMcpServer(createdServer) }, 201);
    }

    // PUT /api/mcp-servers?id=xxx - Update MCP server
    if (req.method === 'PUT') {
      if (!serverId) {
        return createErrorResponse('Server ID required', 400);
      }

      const existingServer = await sql`
        SELECT * FROM mcp_servers 
        WHERE mcp_server_id = ${serverId} AND (tenant_id = ${tenantId} OR ${isAdmin})
      ` as McpServerRow[];

      if (existingServer.length === 0) {
        return createErrorResponse('MCP server not found', 404);
      }

      const body = await req.json();
      const validation = validateMcpServerInput(body);

      if (!validation.valid) {
        const validationError = validation as { valid: false; error: string };
        return createErrorResponse(validationError.error, 400);
      }

      const data = validation.data;

      // Encrypt credentials if provided
      let authConfig: Record<string, unknown> | null = null;
      if (data.auth_type !== 'none' && data.auth_credentials) {
        if (!isEncryptionConfigured()) {
          return createErrorResponse('Encryption not configured. Cannot store credentials.', 500);
        }
        authConfig = encryptCredentials(data.auth_credentials);
      }

      const result = await sql`
        UPDATE mcp_servers SET
          server_name = ${data.server_name},
          server_url = ${data.server_url},
          auth_type = ${data.auth_type},
          auth_config = ${authConfig ? JSON.stringify(authConfig) : null},
          health_status = 'unknown',
          updated_at = now()
        WHERE mcp_server_id = ${serverId}
        RETURNING *
      ` as McpServerRow[];

      const updatedServer = result[0];
      if (!updatedServer) {
        return createErrorResponse('Failed to update MCP server', 500);
      }

      return createSuccessResponse({ server: mapRowToMcpServer(updatedServer) });
    }

    // DELETE /api/mcp-servers?id=xxx - Delete MCP server
    if (req.method === 'DELETE') {
      if (!serverId) {
        return createErrorResponse('Server ID required', 400);
      }

      const result = await sql`
        DELETE FROM mcp_servers 
        WHERE mcp_server_id = ${serverId} AND (tenant_id = ${tenantId} OR ${isAdmin})
        RETURNING mcp_server_id
      `;

      if (result.length === 0) {
        return createErrorResponse('MCP server not found', 404);
      }

      return createSuccessResponse({ deleted: true, serverId });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error in mcp-servers:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
