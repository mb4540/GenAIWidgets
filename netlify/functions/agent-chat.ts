import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';
import { callLLM, type LLMMessage, type ToolDefinition, type ToolCall } from './lib/llm-client';
import type { ModelProvider } from '../../src/types/agent';

interface AgentRow {
  agent_id: string;
  tenant_id: string;
  name: string;
  goal: string;
  system_prompt: string;
  model_provider: string;
  model_name: string;
  max_steps: number;
  temperature: string;
  is_active: boolean;
}

interface SessionRow {
  session_id: string;
  agent_id: string;
  user_id: string;
  tenant_id: string;
  status: string;
  current_step: number;
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
}

interface MemoryRow {
  content: string;
  memory_type: string;
  importance: number;
}

interface ToolRow {
  name: string;
  description: string;
  tool_type: string;
  input_schema: Record<string, unknown>;
}

// Map of builtin tool names to their API endpoints
const BUILTIN_TOOL_ENDPOINTS: Record<string, string> = {
  get_weather: '/api/tools/weather',
};

async function executeToolCall(
  toolCall: ToolCall,
  tools: ToolRow[],
  authToken: string
): Promise<{ success: boolean; result: string }> {
  const toolName = toolCall.function.name;
  const tool = tools.find(t => t.name === toolName);
  
  if (!tool) {
    return {
      success: false,
      result: `Tool not found: ${toolName}`,
    };
  }

  // Handle builtin tools
  if (tool.tool_type === 'builtin') {
    const endpoint = BUILTIN_TOOL_ENDPOINTS[toolName];
    if (!endpoint) {
      return {
        success: false,
        result: `Builtin tool endpoint not configured: ${toolName}`,
      };
    }

    try {
      const toolInput = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      const baseUrl = process.env.URL || 'http://localhost:8888';
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(toolInput),
      });

      const data = await response.json() as { success: boolean; result?: unknown; error?: string };
      
      if (data.success && data.result) {
        return {
          success: true,
          result: JSON.stringify(data.result, null, 2),
        };
      } else {
        return {
          success: false,
          result: data.error || 'Tool execution failed',
        };
      }
    } catch (error) {
      console.error(`[executeToolCall] Builtin tool error:`, error);
      return {
        success: false,
        result: `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Handle MCP server tools (future implementation)
  if (tool.tool_type === 'mcp_server') {
    return {
      success: false,
      result: 'MCP server tool execution not yet implemented.',
    };
  }

  return {
    success: false,
    result: `Unsupported tool type: ${tool.tool_type}`,
  };
}

function buildSystemPrompt(agent: AgentRow, memories: MemoryRow[]): string {
  let prompt = agent.system_prompt;
  prompt += `\n\n## Your Goal\n${agent.goal}`;

  if (memories.length > 0) {
    prompt += '\n\n## Relevant Memories\n';
    for (const memory of memories) {
      prompt += `- [${memory.memory_type}] ${memory.content}\n`;
    }
  }

  prompt += `\n\n## Instructions
- Work towards completing the goal step by step
- Use available tools when needed
- When you believe the goal is complete, respond with "GOAL_COMPLETE" at the start of your message
- If you cannot complete the goal, explain why`;

  return prompt;
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

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

  try {
    const body = await req.json() as { sessionId: string; message: string };
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return createErrorResponse('sessionId and message are required', 400);
    }

    // Get session
    const sessionResult = await sql`
      SELECT * FROM agent_sessions 
      WHERE session_id = ${sessionId} 
      AND (tenant_id = ${tenantId} OR ${isAdmin})
    ` as SessionRow[];

    const session = sessionResult[0];
    if (!session) {
      return createErrorResponse('Session not found', 404);
    }

    if (session.status !== 'active') {
      return createErrorResponse('Session is not active', 400);
    }

    // Get agent
    const agentResult = await sql`
      SELECT * FROM agents WHERE agent_id = ${session.agent_id} AND is_active = true
    ` as AgentRow[];

    const agent = agentResult[0];
    if (!agent) {
      return createErrorResponse('Agent not found or inactive', 404);
    }

    // Get memories
    const memories = await sql`
      SELECT content, memory_type, importance
      FROM agent_long_term_memory
      WHERE agent_id = ${agent.agent_id} AND is_active = true
      ORDER BY importance DESC, last_accessed_at DESC NULLS LAST
      LIMIT 10
    ` as MemoryRow[];

    // Get tools
    const tools = await sql`
      SELECT t.name, t.description, t.tool_type, t.input_schema
      FROM agent_tools t
      JOIN agent_tool_assignments a ON t.tool_id = a.tool_id
      WHERE a.agent_id = ${agent.agent_id} AND t.is_active = true
    ` as ToolRow[];

    const toolDefinitions: ToolDefinition[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    }));

    // Get existing messages
    const existingMessages = await sql`
      SELECT * FROM agent_session_messages
      WHERE session_id = ${sessionId}
      ORDER BY step_number, created_at
    ` as MessageRow[];

    // Build conversation
    const conversationMessages: LLMMessage[] = [
      { role: 'system', content: buildSystemPrompt(agent, memories) },
    ];

    for (const msg of existingMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        conversationMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Save and add user message
    let currentStep = session.current_step + 1;
    await sql`
      INSERT INTO agent_session_messages (session_id, step_number, role, content)
      VALUES (${sessionId}, ${currentStep}, 'user', ${message})
    `;
    conversationMessages.push({ role: 'user', content: message });

    // Update session step
    await sql`
      UPDATE agent_sessions SET current_step = ${currentStep} WHERE session_id = ${sessionId}
    `;

    // Call LLM
    const llmResponse = await callLLM(conversationMessages, toolDefinitions, {
      provider: agent.model_provider as ModelProvider,
      model: agent.model_name,
      temperature: parseFloat(agent.temperature),
    });

    // Save assistant response
    currentStep++;
    const assistantContent = llmResponse.content || '';
    
    await sql`
      INSERT INTO agent_session_messages (session_id, step_number, role, content, tokens_used)
      VALUES (${sessionId}, ${currentStep}, 'assistant', ${assistantContent}, ${llmResponse.tokens_used})
    `;

    // Check for goal completion
    const goalMet = assistantContent.startsWith('GOAL_COMPLETE');
    if (goalMet) {
      await sql`
        UPDATE agent_sessions 
        SET status = 'completed', goal_met = true, current_step = ${currentStep}, ended_at = now()
        WHERE session_id = ${sessionId}
      `;
    } else {
      await sql`
        UPDATE agent_sessions SET current_step = ${currentStep} WHERE session_id = ${sessionId}
      `;
    }

    // Handle tool calls if present - execute tools and get final response
    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      // Extract auth token for tool calls
      const authHeader = req.headers.get('Authorization') || '';
      const authToken = authHeader.replace('Bearer ', '');

      // Add assistant message with tool calls to conversation
      conversationMessages.push({
        role: 'assistant',
        content: assistantContent,
        tool_calls: llmResponse.tool_calls,
      });

      // Execute each tool and collect results
      for (const toolCall of llmResponse.tool_calls) {
        const toolResult = await executeToolCall(toolCall, tools, authToken);
        
        // Save tool result to database
        currentStep++;
        // Parse arguments to ensure valid JSON, then stringify for safe insertion
        let toolInput: Record<string, unknown> = {};
        try {
          toolInput = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        } catch {
          toolInput = { raw: toolCall.function.arguments };
        }
        await sql`
          INSERT INTO agent_session_messages (session_id, step_number, role, content, tool_name, tool_input, tool_output)
          VALUES (${sessionId}, ${currentStep}, 'tool', ${toolResult.result}, ${toolCall.function.name}, 
                  ${JSON.stringify(toolInput)}::jsonb, ${JSON.stringify({ success: toolResult.success, result: toolResult.result })}::jsonb)
        `;

        // Add tool result to conversation
        conversationMessages.push({
          role: 'tool',
          content: toolResult.result,
          tool_call_id: toolCall.id,
        });
      }

      // Make second LLM call with tool results
      const finalResponse = await callLLM(conversationMessages, toolDefinitions, {
        provider: agent.model_provider as ModelProvider,
        model: agent.model_name,
        temperature: parseFloat(agent.temperature),
      });

      // Save final assistant response
      currentStep++;
      const finalContent = finalResponse.content || '';
      await sql`
        INSERT INTO agent_session_messages (session_id, step_number, role, content, tokens_used)
        VALUES (${sessionId}, ${currentStep}, 'assistant', ${finalContent}, ${finalResponse.tokens_used})
      `;

      // Check for goal completion
      const finalGoalMet = finalContent.startsWith('GOAL_COMPLETE');
      if (finalGoalMet) {
        await sql`
          UPDATE agent_sessions 
          SET status = 'completed', goal_met = true, current_step = ${currentStep}, ended_at = now()
          WHERE session_id = ${sessionId}
        `;
      } else {
        await sql`
          UPDATE agent_sessions SET current_step = ${currentStep} WHERE session_id = ${sessionId}
        `;
      }

      return createSuccessResponse({
        message: {
          role: 'assistant',
          content: finalContent,
          tokens_used: (llmResponse.tokens_used || 0) + (finalResponse.tokens_used || 0),
        },
        session: {
          status: finalGoalMet ? 'completed' : 'active',
          current_step: currentStep,
          goal_met: finalGoalMet,
        },
      });
    }

    return createSuccessResponse({
      message: {
        role: 'assistant',
        content: assistantContent,
        tokens_used: llmResponse.tokens_used,
      },
      session: {
        status: goalMet ? 'completed' : 'active',
        current_step: currentStep,
        goal_met: goalMet,
      },
    });
  } catch (error) {
    console.error('Error in agent-chat:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
