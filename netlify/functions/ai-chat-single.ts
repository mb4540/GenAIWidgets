import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface ChatRequest {
  sessionId: string;
  message: string;
}

interface MessageRow {
  message_id: string;
  session_id: string;
  role: string;
  content: string;
  tokens_used: number | null;
  created_at: string;
}

interface SessionRow {
  session_id: string;
  tenant_id: string;
  user_id: string;
  model_provider: string;
  model_name: string;
  title: string | null;
}

async function queryOpenAI(
  messages: Array<{ role: string; content: string }>,
  model: string
): Promise<{ text: string; tokens: number }> {
  const openai = new OpenAI();
  const isGpt5OrNewer = model.startsWith('gpt-5') || model.startsWith('gpt-4.1') || model.startsWith('o3') || model.startsWith('o4');
  
  const completion = await openai.chat.completions.create({
    model,
    messages: messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
    ...(isGpt5OrNewer ? { max_completion_tokens: 4096 } : { max_tokens: 4096 }),
  });

  const text = completion.choices?.[0]?.message?.content || 'No response';
  const tokens = completion.usage?.total_tokens || 0;
  return { text, tokens };
}

async function queryAnthropic(
  messages: Array<{ role: string; content: string }>,
  model: string
): Promise<{ text: string; tokens: number }> {
  const anthropic = new Anthropic();
  
  // Filter out system messages for Anthropic (handle separately if needed)
  const filteredMessages = messages.filter(m => m.role !== 'system');
  
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    messages: filteredMessages.map(m => ({ 
      role: m.role as 'user' | 'assistant', 
      content: m.content 
    })),
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const text = textBlock && 'text' in textBlock ? textBlock.text : 'No response';
  const tokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  return { text, tokens };
}

async function queryGemini(
  messages: Array<{ role: string; content: string }>,
  model: string
): Promise<{ text: string; tokens: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  const baseUrl = process.env.GOOGLE_GEMINI_BASE_URL;

  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  if (!baseUrl) {
    throw new Error('Gemini base URL not configured');
  }

  // Convert messages to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `${baseUrl}/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({ contents }),
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Gemini error: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
  const tokens = data.usageMetadata?.totalTokenCount || 0;
  return { text, tokens };
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    const authError = authResult as { success: false; error: string; status: number };
    return createErrorResponse(authError.error, authError.status);
  }

  const { userId, tenantId } = authResult.context;

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  try {
    const body = await req.json() as ChatRequest;
    const { sessionId, message } = body;

    if (!sessionId) {
      return createErrorResponse('sessionId is required', 400);
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return createErrorResponse('message is required', 400);
    }

    // Verify session ownership and get model info
    const sessions = await sql`
      SELECT * FROM ai_chat_sessions 
      WHERE session_id = ${sessionId} 
      AND user_id = ${userId}
      AND tenant_id = ${tenantId}
    ` as SessionRow[];

    if (sessions.length === 0) {
      return createErrorResponse('Session not found', 404);
    }

    const session = sessions[0]!;
    const { model_provider, model_name } = session;

    // Save user message
    await sql`
      INSERT INTO ai_chat_messages (session_id, role, content)
      VALUES (${sessionId}, 'user', ${message.trim()})
    `;

    // Get conversation history
    const history = await sql`
      SELECT role, content FROM ai_chat_messages 
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    ` as Array<{ role: string; content: string }>;

    // Call the appropriate AI provider
    let responseText: string;
    let tokensUsed: number;

    try {
      switch (model_provider) {
        case 'openai':
          ({ text: responseText, tokens: tokensUsed } = await queryOpenAI(history, model_name));
          break;
        case 'anthropic':
          ({ text: responseText, tokens: tokensUsed } = await queryAnthropic(history, model_name));
          break;
        case 'gemini':
        case 'google':
          ({ text: responseText, tokens: tokensUsed } = await queryGemini(history, model_name));
          break;
        default:
          return createErrorResponse(`Unsupported provider: ${model_provider}`, 400);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ai-chat-single] Provider error:`, error);
      return createErrorResponse(`AI provider error: ${errorMessage}`, 500);
    }

    // Save assistant response
    const savedMessage = await sql`
      INSERT INTO ai_chat_messages (session_id, role, content, tokens_used)
      VALUES (${sessionId}, 'assistant', ${responseText}, ${tokensUsed})
      RETURNING *
    ` as MessageRow[];

    // Auto-generate title from first message if not set
    if (!session.title && history.length <= 2) {
      const title = message.trim().slice(0, 50) + (message.length > 50 ? '...' : '');
      await sql`
        UPDATE ai_chat_sessions SET title = ${title} WHERE session_id = ${sessionId}
      `;
    }

    return createSuccessResponse({
      message: {
        message_id: savedMessage[0]!.message_id,
        role: 'assistant',
        content: responseText,
        tokens_used: tokensUsed,
        created_at: savedMessage[0]!.created_at,
      },
    });
  } catch (error) {
    console.error('[ai-chat-single] Error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
