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
  list_files: '/api/tools/files',
  read_file: '/api/tools/files',
  create_file: '/api/tools/files',
  delete_file: '/api/tools/files',
  update_plan: '/api/tools/plan',
  web_search: '/api/tools/web-search',
};

// Helper to auto-complete the current in-progress step when work tools succeed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoCompleteCurrentStep(
  sql: any,
  sessionId: string,
  toolName: string,
  _toolResult: string
): Promise<void> {
  try {
    // Fetch current plan
    const planResult = await sql`
      SELECT memory_value FROM agent_session_memory
      WHERE session_id = ${sessionId} AND memory_key = 'execution_plan'
    ` as { memory_value: ExecutionPlan }[];
    
    if (!planResult[0]?.memory_value) return;
    
    const plan = planResult[0].memory_value;
    if (plan.status !== 'executing') return;
    
    // Find the in-progress step
    const inProgressStep = plan.steps.find(s => s.status === 'in_progress');
    if (!inProgressStep) return;
    
    // Mark it completed with a summary
    inProgressStep.status = 'completed';
    inProgressStep.result = `Auto-completed: ${toolName} executed successfully`;
    inProgressStep.completed_at = new Date().toISOString();
    
    // Update current_step_index to next pending step
    const nextPendingIndex = plan.steps.findIndex(s => s.status === 'pending');
    plan.current_step_index = nextPendingIndex >= 0 ? nextPendingIndex : plan.steps.length;
    plan.updated_at = new Date().toISOString();
    
    // Save updated plan
    await sql`
      UPDATE agent_session_memory
      SET memory_value = ${JSON.stringify(plan)}::jsonb, updated_at = now()
      WHERE session_id = ${sessionId} AND memory_key = 'execution_plan'
    `;
    
    console.log(`[agent-chat] Auto-completed step ${inProgressStep.step_number} after ${toolName} success`);
  } catch (error) {
    console.error('[agent-chat] Error auto-completing step:', error);
  }
}

async function executeToolCall(
  toolCall: ToolCall,
  tools: ToolRow[],
  authToken: string,
  sessionId: string
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
      
      // For file tools, add the action based on tool name
      const fileToolActions: Record<string, string> = {
        list_files: 'list',
        read_file: 'read',
        create_file: 'create',
        delete_file: 'delete',
      };
      if (fileToolActions[toolName]) {
        toolInput.action = fileToolActions[toolName];
      }
      
      // For update_plan tool, add the session_id (snake_case to match tool-plan.ts)
      if (toolName === 'update_plan') {
        toolInput.session_id = sessionId;
      }
      
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

interface ExecutionPlanStep {
  step_number: number;
  description: string;
  status: string;
  result?: string;
  completed_at?: string;
}

interface ExecutionPlan {
  goal: string;
  steps: ExecutionPlanStep[];
  status: string;
  current_step_index: number;
  created_at?: string;
  updated_at?: string;
}

function buildSystemPrompt(
  agent: AgentRow,
  memories: MemoryRow[],
  hasUpdatePlanTool: boolean,
  existingPlan?: ExecutionPlan | null
): string {
  let prompt = agent.system_prompt;
  prompt += `\n\n## Your Goal\n${agent.goal}`;

  if (memories.length > 0) {
    prompt += '\n\n## Relevant Memories\n';
    for (const memory of memories) {
      prompt += `- [${memory.memory_type}] ${memory.content}\n`;
    }
  }

  // Include planning instructions if the agent has access to the update_plan tool
  if (hasUpdatePlanTool) {
    // Check if there's an existing plan
    if (existingPlan && existingPlan.status === 'executing') {
      // EXISTING PLAN - tell agent to continue execution, NOT create new plan
      const pendingSteps = existingPlan.steps.filter(s => s.status === 'pending');
      const completedSteps = existingPlan.steps.filter(s => s.status === 'completed');
      const currentStep = existingPlan.steps.find(s => s.status === 'in_progress') || pendingSteps[0];
      
      // Determine the actual current step and whether it's already in progress
      const inProgressStep = existingPlan.steps.find(s => s.status === 'in_progress');
      const nextPendingStep = pendingSteps[0];
      const stepToExecute = inProgressStep || nextPendingStep;
      const isAlreadyInProgress = !!inProgressStep;
      
      prompt += `\n\n## CURRENT EXECUTION PLAN (Already Created - DO NOT CREATE NEW PLAN)

**Goal:** ${existingPlan.goal}

**Progress:** ${completedSteps.length}/${existingPlan.steps.length} steps completed

**Steps:**
${existingPlan.steps.map(s => `${s.step_number}. [${s.status.toUpperCase()}] ${s.description}${s.result ? ` - Result: ${s.result}` : ''}`).join('\n')}

### IMPORTANT: You have an active plan. DO NOT call update_plan with action="create".

### Your Next Action:
${stepToExecute ? (isAlreadyInProgress ? `
Step ${stepToExecute.step_number} is ALREADY IN PROGRESS. Do NOT call update_plan with step_status="in_progress" again.

**EXECUTE NOW:** "${stepToExecute.description}"
- Use the appropriate tools (create_file, read_file, list_files, delete_file, etc.) to complete this step
- After executing, call \`update_plan\` with action="update_step", step_number=${stepToExecute.step_number}, step_status="completed", step_result="summary of what you did"
` : `
1. Mark step ${stepToExecute.step_number} as in_progress: \`update_plan\` with action="update_step", step_number=${stepToExecute.step_number}, step_status="in_progress"
2. Execute step ${stepToExecute.step_number}: "${stepToExecute.description}" using your tools
3. Mark step ${stepToExecute.step_number} as completed: \`update_plan\` with action="update_step", step_number=${stepToExecute.step_number}, step_status="completed", step_result="what you accomplished"
`) : `All steps completed! Call \`update_plan\` with action="complete" and reason="summary", then respond with GOAL_COMPLETE.`}`;
    } else {
      // NO PLAN - tell agent to create one first
      prompt += `\n\n## Execution Model - REQUIRED

You operate by creating and following execution plans. Follow this workflow:

### 1. PLANNING PHASE (Required First Step)
When you receive a new task, you MUST:
1. Call the \`update_plan\` tool with action="create" to create your execution plan
2. Break down the task into clear, actionable steps (3-7 steps typically)
3. Each step should be specific and achievable with your available tools

### 2. EXECUTION PHASE
After creating your plan:
1. Call \`update_plan\` with action="update_step", step_number=1, step_status="in_progress"
2. Execute the step using appropriate tools
3. Call \`update_plan\` with action="update_step", step_number=1, step_status="completed", step_result="summary of what you did"
4. Repeat for each subsequent step

### 3. COMPLETION
When all steps are done:
- Call \`update_plan\` with action="complete" and reason="summary of accomplishments"
- Then respond with "GOAL_COMPLETE" followed by your final summary

### Rules
- ALWAYS create a plan first before doing anything else
- ALWAYS update your plan status after each action
- Keep steps atomic and verifiable`;
    }
  } else {
    prompt += `\n\n## Instructions
- Work towards completing the goal step by step
- Use available tools when needed
- When you believe the goal is complete, respond with "GOAL_COMPLETE" at the start of your message
- If you cannot complete the goal, explain why`;
  }

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

    // Check if agent has access to update_plan tool
    const hasUpdatePlanTool = tools.some(t => t.name === 'update_plan');

    // Fetch existing execution plan from session memory if available
    let existingPlan: ExecutionPlan | null = null;
    if (hasUpdatePlanTool) {
      const planResult = await sql`
        SELECT memory_value FROM agent_session_memory
        WHERE session_id = ${sessionId} AND memory_key = 'execution_plan'
      ` as Array<{ memory_value: ExecutionPlan }>;
      
      if (planResult.length > 0 && planResult[0]) {
        existingPlan = planResult[0].memory_value;
        console.log('[agent-chat] Found existing plan:', existingPlan?.status, 'steps:', existingPlan?.steps?.length);
      }
    }

    // Build conversation
    const conversationMessages: LLMMessage[] = [
      { role: 'system', content: buildSystemPrompt(agent, memories, hasUpdatePlanTool, existingPlan) },
    ];

    for (const msg of existingMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        // Skip messages with empty content to avoid LLM API errors
        const content = msg.content?.trim() || '';
        if (!content) continue;
        
        conversationMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: content,
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
      // Note: When LLM returns tool_calls, content may be empty. Use placeholder if needed.
      conversationMessages.push({
        role: 'assistant',
        content: assistantContent || 'Executing tools...',
        tool_calls: llmResponse.tool_calls,
      });

      // Execute each tool and collect results
      // Track if we only called update_plan (no actual work tools)
      const workToolNames = ['list_files', 'read_file', 'create_file', 'delete_file', 'get_weather'];
      let calledWorkTool = false;
      
      for (const toolCall of llmResponse.tool_calls) {
        const toolResult = await executeToolCall(toolCall, tools, authToken, sessionId);
        
        // Track if this is a work tool (not just plan management)
        if (workToolNames.includes(toolCall.function.name)) {
          calledWorkTool = true;
          
          // Auto-complete the current in-progress step when work tools succeed
          if (toolResult.success) {
            await autoCompleteCurrentStep(sql, sessionId, toolCall.function.name, toolResult.result);
          }
        }
        
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

      // SERVER-SIDE ENFORCEMENT: If agent only called update_plan without doing actual work,
      // inject a stern message and force another LLM call to execute the actual step
      if (!calledWorkTool && llmResponse.tool_calls.some(tc => tc.function.name === 'update_plan')) {
        console.log('[agent-chat] Agent only called update_plan without work tools - forcing execution');
        
        // Add enforcement message
        currentStep++;
        const enforcementMessage = 'You updated the plan status but did NOT execute the actual step. You MUST now use a file tool (create_file, read_file, list_files, or delete_file) to perform the work described in the step. Do NOT call update_plan again until you have completed the actual work.';
        await sql`
          INSERT INTO agent_session_messages (session_id, step_number, role, content)
          VALUES (${sessionId}, ${currentStep}, 'user', ${enforcementMessage})
        `;
        
        conversationMessages.push({
          role: 'user',
          content: enforcementMessage,
        });
        
        // Make enforcement LLM call
        const enforcementResponse = await callLLM(conversationMessages, toolDefinitions, {
          provider: agent.model_provider as ModelProvider,
          model: agent.model_name,
          temperature: parseFloat(agent.temperature),
        });
        
        // If enforcement call has tool calls, execute them
        if (enforcementResponse.tool_calls && enforcementResponse.tool_calls.length > 0) {
          conversationMessages.push({
            role: 'assistant',
            content: enforcementResponse.content || 'Executing tools...',
            tool_calls: enforcementResponse.tool_calls,
          });
          
          for (const toolCall of enforcementResponse.tool_calls) {
            const toolResult = await executeToolCall(toolCall, tools, authToken, sessionId);
            
            currentStep++;
            let toolInput2: Record<string, unknown> = {};
            try {
              toolInput2 = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
            } catch {
              toolInput2 = { raw: toolCall.function.arguments };
            }
            await sql`
              INSERT INTO agent_session_messages (session_id, step_number, role, content, tool_name, tool_input, tool_output)
              VALUES (${sessionId}, ${currentStep}, 'tool', ${toolResult.result}, ${toolCall.function.name}, 
                      ${JSON.stringify(toolInput2)}::jsonb, ${JSON.stringify({ success: toolResult.success, result: toolResult.result })}::jsonb)
            `;
            
            conversationMessages.push({
              role: 'tool',
              content: toolResult.result,
              tool_call_id: toolCall.id,
            });
          }
        }
        
        // Save enforcement response
        currentStep++;
        const enforcementContent = enforcementResponse.content || '';
        await sql`
          INSERT INTO agent_session_messages (session_id, step_number, role, content, tokens_used)
          VALUES (${sessionId}, ${currentStep}, 'assistant', ${enforcementContent}, ${enforcementResponse.tokens_used})
        `;
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

      // Check if there's an active plan with pending steps
      const planResult = await sql`
        SELECT memory_value FROM agent_session_memory
        WHERE session_id = ${sessionId} AND memory_key = 'execution_plan'
      ` as { memory_value: { status: string; steps: { status: string }[] } }[];
      const plan = planResult[0]?.memory_value;
      const hasPendingSteps = plan && plan.status === 'executing' && 
        plan.steps.some((s: { status: string }) => s.status === 'pending' || s.status === 'in_progress');

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
        shouldContinue: !finalGoalMet && hasPendingSteps,
      });
    }

    // Check if there's an active plan with pending steps
    const planResult2 = await sql`
      SELECT memory_value FROM agent_session_memory
      WHERE session_id = ${sessionId} AND memory_key = 'execution_plan'
    ` as { memory_value: { status: string; steps: { status: string }[] } }[];
    const plan2 = planResult2[0]?.memory_value;
    const hasPendingSteps2 = plan2 && plan2.status === 'executing' && 
      plan2.steps.some((s: { status: string }) => s.status === 'pending' || s.status === 'in_progress');

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
      shouldContinue: !goalMet && hasPendingSteps2,
    });
  } catch (error) {
    console.error('Error in agent-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    return createErrorResponse(`Internal server error: ${errorMessage}`, 500);
  }
}
