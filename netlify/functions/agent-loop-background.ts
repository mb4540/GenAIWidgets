import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { callLLM, type LLMMessage, type ToolDefinition, type ToolCall } from './lib/llm-client';
import type { ModelProvider } from '../../src/types/agent';

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
}

interface SessionRow {
  session_id: string;
  agent_id: string;
  user_id: string;
  tenant_id: string;
  status: string;
  current_step: number;
  goal_met: boolean;
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
}

interface MemoryRow {
  memory_id: string;
  content: string;
  memory_type: string;
  importance: number;
}

interface ToolRow {
  tool_id: string;
  name: string;
  description: string;
  tool_type: string;
  input_schema: Record<string, unknown>;
}

async function getRelevantMemories(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any,
  agentId: string,
  limit = 10
): Promise<MemoryRow[]> {
  return await sql`
    SELECT memory_id, content, memory_type, importance
    FROM agent_long_term_memory
    WHERE agent_id = ${agentId} AND is_active = true
    ORDER BY importance DESC, last_accessed_at DESC NULLS LAST
    LIMIT ${limit}
  ` as MemoryRow[];
}

async function getAgentTools(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any,
  agentId: string
): Promise<ToolRow[]> {
  return await sql`
    SELECT t.tool_id, t.name, t.description, t.tool_type, t.input_schema
    FROM agent_tools t
    JOIN agent_tool_assignments a ON t.tool_id = a.tool_id
    WHERE a.agent_id = ${agentId} AND t.is_active = true
  ` as ToolRow[];
}

async function saveMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any,
  sessionId: string,
  stepNumber: number,
  role: string,
  content: string,
  toolName?: string,
  toolInput?: Record<string, unknown>,
  toolOutput?: Record<string, unknown>,
  reasoning?: string,
  tokensUsed?: number
): Promise<void> {
  await sql`
    INSERT INTO agent_session_messages (
      session_id, step_number, role, content, tool_name, tool_input, tool_output, reasoning, tokens_used
    ) VALUES (
      ${sessionId}, ${stepNumber}, ${role}, ${content},
      ${toolName || null}, ${toolInput ? JSON.stringify(toolInput) : null},
      ${toolOutput ? JSON.stringify(toolOutput) : null}, ${reasoning || null}, ${tokensUsed || null}
    )
  `;
}

async function updateSessionStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any,
  sessionId: string,
  status: string,
  currentStep: number,
  goalMet: boolean = false
): Promise<void> {
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    await sql`
      UPDATE agent_sessions
      SET status = ${status}, current_step = ${currentStep}, goal_met = ${goalMet}, ended_at = now()
      WHERE session_id = ${sessionId}
    `;
  } else {
    await sql`
      UPDATE agent_sessions
      SET status = ${status}, current_step = ${currentStep}, goal_met = ${goalMet}
      WHERE session_id = ${sessionId}
    `;
  }
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

function convertToolsToDefinitions(tools: ToolRow[]): ToolDefinition[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  }));
}

async function executeToolCall(
  _toolCall: ToolCall,
  _tools: ToolRow[]
): Promise<{ success: boolean; result: string }> {
  // For now, return a placeholder - actual MCP execution will be implemented later
  return {
    success: false,
    result: 'Tool execution not yet implemented. MCP server integration pending.',
  };
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  // This is a background function - it runs asynchronously
  // Triggered by POST with sessionId and initial message

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sql = neon(DATABASE_URL);

  try {
    const body = await req.json() as { sessionId: string; message: string };
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return new Response(JSON.stringify({ error: 'sessionId and message required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get session
    const sessionResult = await sql`
      SELECT * FROM agent_sessions WHERE session_id = ${sessionId}
    ` as SessionRow[];

    const session = sessionResult[0];
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (session.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Session is not active' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get agent
    const agentResult = await sql`
      SELECT * FROM agents WHERE agent_id = ${session.agent_id}
    ` as AgentRow[];

    const agent = agentResult[0];
    if (!agent) {
      await updateSessionStatus(sql, sessionId, 'failed', session.current_step);
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get memories and tools
    const memories = await getRelevantMemories(sql, agent.agent_id);
    const tools = await getAgentTools(sql, agent.agent_id);
    const toolDefinitions = convertToolsToDefinitions(tools);

    // Get existing messages
    const existingMessages = await sql`
      SELECT * FROM agent_session_messages
      WHERE session_id = ${sessionId}
      ORDER BY step_number, created_at
    ` as MessageRow[];

    // Build conversation history
    const conversationMessages: LLMMessage[] = [
      { role: 'system', content: buildSystemPrompt(agent, memories) },
    ];

    for (const msg of existingMessages) {
      if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
        conversationMessages.push({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        });
      } else if (msg.role === 'tool' && msg.tool_name) {
        conversationMessages.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.tool_name,
        });
      }
    }

    // Add new user message
    let currentStep = session.current_step + 1;
    await saveMessage(sql, sessionId, currentStep, 'user', message);
    conversationMessages.push({ role: 'user', content: message });

    // Agent loop
    let loopCount = 0;
    const maxSteps = agent.max_steps;

    while (loopCount < maxSteps) {
      loopCount++;
      currentStep++;

      // Check if session was cancelled
      const statusCheck = await sql`
        SELECT status FROM agent_sessions WHERE session_id = ${sessionId}
      ` as { status: string }[];

      if (statusCheck[0]?.status === 'cancelled') {
        break;
      }

      // Call LLM
      const llmResponse = await callLLM(conversationMessages, toolDefinitions, {
        provider: agent.model_provider as ModelProvider,
        model: agent.model_name,
        temperature: parseFloat(agent.temperature),
      });

      // Check for goal completion
      if (llmResponse.content?.startsWith('GOAL_COMPLETE')) {
        await saveMessage(
          sql, sessionId, currentStep, 'assistant',
          llmResponse.content, undefined, undefined, undefined,
          llmResponse.reasoning || undefined, llmResponse.tokens_used
        );
        await updateSessionStatus(sql, sessionId, 'completed', currentStep, true);
        break;
      }

      // Handle tool calls
      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        // Save assistant message with tool calls
        await saveMessage(
          sql, sessionId, currentStep, 'assistant',
          llmResponse.content || 'Using tools...',
          undefined, undefined, undefined,
          llmResponse.reasoning || undefined, llmResponse.tokens_used
        );

        conversationMessages.push({
          role: 'assistant',
          content: llmResponse.content || '',
          tool_calls: llmResponse.tool_calls,
        });

        // Execute each tool call
        for (const toolCall of llmResponse.tool_calls) {
          currentStep++;
          const toolResult = await executeToolCall(toolCall, tools);

          await saveMessage(
            sql, sessionId, currentStep, 'tool',
            toolResult.result,
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments) as Record<string, unknown>,
            { success: toolResult.success, result: toolResult.result }
          );

          conversationMessages.push({
            role: 'tool',
            content: toolResult.result,
            tool_call_id: toolCall.id,
          });
        }

        await updateSessionStatus(sql, sessionId, 'active', currentStep);
      } else {
        // Regular response without tool calls
        await saveMessage(
          sql, sessionId, currentStep, 'assistant',
          llmResponse.content || '',
          undefined, undefined, undefined,
          llmResponse.reasoning || undefined, llmResponse.tokens_used
        );

        conversationMessages.push({
          role: 'assistant',
          content: llmResponse.content || '',
        });

        await updateSessionStatus(sql, sessionId, 'active', currentStep);

        // If no tool calls and not goal complete, we're waiting for user input
        break;
      }
    }

    // Check if we hit max steps
    if (loopCount >= maxSteps) {
      await updateSessionStatus(sql, sessionId, 'completed', currentStep, false);
    }

    return new Response(JSON.stringify({ success: true, sessionId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in agent-loop-background:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  type: 'background',
};
