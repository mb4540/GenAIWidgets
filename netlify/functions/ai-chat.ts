import type { Context } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AiChatRequest {
  message: string;
  providers: {
    openai: boolean;
    anthropic: boolean;
    gemini: boolean;
  };
}

interface ProviderResult {
  ok: boolean;
  text?: string;
  error?: string;
}

interface AiChatResponse {
  success: true;
  results: {
    openai?: ProviderResult;
    anthropic?: ProviderResult;
    gemini?: ProviderResult;
  };
}

async function queryOpenAI(message: string): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    return { ok: false, error: 'OpenAI API key not configured' };
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: message }],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: `OpenAI error: ${response.status}` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || 'No response';
    return { ok: true, text };
  } catch (error) {
    return { ok: false, error: 'Failed to connect to OpenAI' };
  }
}

async function queryAnthropic(message: string): Promise<ProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

  if (!apiKey) {
    return { ok: false, error: 'Anthropic API key not configured' };
  }

  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: `Anthropic error: ${response.status}` };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || 'No response';
    return { ok: true, text };
  } catch (error) {
    return { ok: false, error: 'Failed to connect to Anthropic' };
  }
}

async function queryGemini(message: string): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { ok: false, error: 'Gemini API key not configured' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(message);
    const text = result.response.text();
    return { ok: true, text };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, error: `Gemini error: ${errorMessage}` };
  }
}

export default async function handler(req: Request, _context: Context) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as AiChatRequest;
    const { message, providers } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: AiChatResponse['results'] = {};
    const promises: Promise<void>[] = [];

    if (providers?.openai) {
      promises.push(
        queryOpenAI(message).then((result) => {
          results.openai = result;
        })
      );
    }

    if (providers?.anthropic) {
      promises.push(
        queryAnthropic(message).then((result) => {
          results.anthropic = result;
        })
      );
    }

    if (providers?.gemini) {
      promises.push(
        queryGemini(message).then((result) => {
          results.gemini = result;
        })
      );
    }

    await Promise.all(promises);

    const response: AiChatResponse = {
      success: true,
      results,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
