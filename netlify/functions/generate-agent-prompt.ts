import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';
import { callLLM, type LLMMessage } from './lib/llm-client';
import type { ModelProvider } from '../../src/types/agent';

interface PromptRow {
  prompt_id: string;
  function_name: string;
  display_name: string;
  description: string;
  model_provider: string;
  model_name: string;
  system_prompt: string;
  user_prompt_template: string;
  temperature: string;
  max_tokens: number;
  is_active: boolean;
}

interface GeneratePromptRequest {
  name: string;
  description: string;
  goal: string;
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

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  try {
    const body = await req.json() as GeneratePromptRequest;
    const { name, description, goal } = body;

    if (!name || !description || !goal) {
      return createErrorResponse('name, description, and goal are required', 400);
    }

    // Fetch the prompt configuration from database
    const promptResult = await sql`
      SELECT * FROM prompts 
      WHERE function_name = 'generate_agent_prompt' AND is_active = true
      LIMIT 1
    ` as PromptRow[];

    const promptConfig = promptResult[0];
    if (!promptConfig) {
      return createErrorResponse('Agent prompt generator not configured. Please create a prompt with function_name "generate_agent_prompt" in Admin Dashboard.', 404);
    }

    // Build the user message from template
    let userMessage = promptConfig.user_prompt_template || '{{user_message}}';
    userMessage = userMessage.replace('{{name}}', name);
    userMessage = userMessage.replace('{{description}}', description);
    userMessage = userMessage.replace('{{goal}}', goal);
    userMessage = userMessage.replace('{{user_message}}', `Name: ${name}\nDescription: ${description}\nGoal: ${goal}`);

    // Build messages for LLM
    const messages: LLMMessage[] = [];
    
    if (promptConfig.system_prompt) {
      messages.push({
        role: 'system',
        content: promptConfig.system_prompt,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    // Call LLM
    const response = await callLLM(messages, [], {
      provider: promptConfig.model_provider as ModelProvider,
      model: promptConfig.model_name,
      temperature: parseFloat(promptConfig.temperature) || 0.7,
      maxTokens: promptConfig.max_tokens || 2048,
    });

    if (!response.content) {
      return createErrorResponse('No response from AI', 500);
    }

    return createSuccessResponse({
      prompt: response.content.trim(),
      tokens_used: response.tokens_used,
    });
  } catch (error) {
    console.error('Error generating agent prompt:', error);
    return createErrorResponse('Failed to generate prompt', 500);
  }
}
