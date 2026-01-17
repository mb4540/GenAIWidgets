/**
 * TypeScript types for Agent Mode Chat feature
 */

// Model providers supported via Netlify AI Gateway
export type ModelProvider = 'openai' | 'anthropic' | 'gemini';

// Session status values
export type SessionStatus = 'active' | 'completed' | 'failed' | 'cancelled';

// Message roles in a session
export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

// Memory types for long-term memory
export type MemoryType = 'fact' | 'preference' | 'learned' | 'user_provided';

// Tool types
export type ToolType = 'mcp_server' | 'python_script' | 'builtin';

// MCP server authentication types
export type McpAuthType = 'none' | 'api_key' | 'bearer' | 'basic';

// MCP server health status
export type McpHealthStatus = 'healthy' | 'unhealthy' | 'unknown';

/**
 * Agent definition
 */
export interface Agent {
  agent_id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  description: string | null;
  goal: string;
  system_prompt: string;
  model_provider: ModelProvider;
  model_name: string;
  max_steps: number;
  temperature: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assigned_tools?: Array<{ tool_id: string; name: string }>;
}

/**
 * Agent creation/update payload
 */
export interface AgentInput {
  name: string;
  description?: string;
  goal: string;
  system_prompt: string;
  model_provider: ModelProvider;
  model_name: string;
  max_steps?: number;
  temperature?: number;
  is_active?: boolean;
}

/**
 * Agent session (conversation)
 */
export interface AgentSession {
  session_id: string;
  agent_id: string;
  user_id: string;
  tenant_id: string;
  title: string | null;
  status: SessionStatus;
  current_step: number;
  goal_met: boolean;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

/**
 * Session creation payload
 */
export interface SessionInput {
  title?: string;
}

/**
 * Message in a session
 */
export interface SessionMessage {
  message_id: string;
  session_id: string;
  step_number: number;
  role: MessageRole;
  content: string;
  tool_name: string | null;
  tool_input: Record<string, unknown> | null;
  tool_output: Record<string, unknown> | null;
  reasoning: string | null;
  tokens_used: number | null;
  created_at: string;
}

/**
 * Message creation payload
 */
export interface MessageInput {
  content: string;
}

/**
 * Long-term memory entry
 */
export interface AgentMemory {
  memory_id: string;
  agent_id: string;
  tenant_id: string;
  memory_type: MemoryType;
  content: string;
  source_session_id: string | null;
  importance: number;
  last_accessed_at: string | null;
  access_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Memory creation/update payload
 */
export interface MemoryInput {
  content: string;
  memory_type?: MemoryType;
  importance?: number;
  is_active?: boolean;
}

/**
 * Tool definition
 */
export interface AgentTool {
  tool_id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  description: string;
  tool_type: ToolType;
  input_schema: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Tool creation/update payload
 */
export interface ToolInput {
  name: string;
  description: string;
  tool_type: ToolType;
  input_schema: Record<string, unknown>;
  is_active?: boolean;
}

/**
 * Tool assignment to an agent
 */
export interface ToolAssignment {
  assignment_id: string;
  agent_id: string;
  tool_id: string;
  is_required: boolean;
  created_at: string;
}

/**
 * MCP server configuration
 */
export interface McpServer {
  mcp_server_id: string;
  tool_id: string;
  tenant_id: string;
  server_name: string;
  server_url: string;
  auth_type: McpAuthType;
  auth_config: Record<string, unknown> | null;
  health_status: McpHealthStatus;
  last_health_check: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * MCP server creation/update payload
 */
export interface McpServerInput {
  server_name: string;
  server_url: string;
  auth_type?: McpAuthType;
  auth_credentials?: {
    api_key?: string;
    bearer_token?: string;
    username?: string;
    password?: string;
  };
}

/**
 * Session with messages (for detail view)
 */
export interface SessionWithMessages extends AgentSession {
  messages: SessionMessage[];
  agent?: Agent;
}

/**
 * Agent with tool assignments (for detail view)
 */
export interface AgentWithTools extends Agent {
  tools: AgentTool[];
}

/**
 * Streaming event types
 */
export type StreamEventType = 
  | 'reasoning'
  | 'tool_call'
  | 'tool_result'
  | 'response'
  | 'error'
  | 'done';

/**
 * Streaming event payload
 */
export interface StreamEvent {
  type: StreamEventType;
  data: {
    content?: string;
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    tool_output?: Record<string, unknown>;
    error?: string;
    step?: number;
    goal_met?: boolean;
  };
  timestamp: string;
}
