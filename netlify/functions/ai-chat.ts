import type { Context } from '@netlify/functions';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

interface AiChatRequest {
  message: string;
  models: {
    openai: string;
    anthropic: string;
    gemini: string;
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

async function queryOpenAI(message: string, model: string): Promise<ProviderResult> {
  try {
    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: message }],
      max_tokens: 1024,
    });

    const text = completion.choices?.[0]?.message?.content || 'No response';
    return { ok: true, text };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, error: `OpenAI error: ${errorMessage}` };
  }
}

async function queryAnthropic(message: string, model: string): Promise<ProviderResult> {
  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: message }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : 'No response';
    return { ok: true, text };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, error: `Anthropic error: ${errorMessage}` };
  }
}

async function queryGemini(message: string, model: string): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const baseUrl = process.env.GOOGLE_GEMINI_BASE_URL;

  if (!apiKey) {
    return { ok: false, error: 'Gemini API key not configured' };
  }

  if (!baseUrl) {
    return { ok: false, error: 'Gemini base URL not configured' };
  }

  try {
    const response = await fetch(
      `${baseUrl}/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      return { ok: false, error: `Gemini error: ${response.status} - ${errorData}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
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
    const { message, models } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: AiChatResponse['results'] = {};
    const promises: Promise<void>[] = [];

    if (models?.openai) {
      promises.push(
        queryOpenAI(message, models.openai).then((result) => {
          results.openai = result;
        })
      );
    }

    if (models?.anthropic) {
      promises.push(
        queryAnthropic(message, models.anthropic).then((result) => {
          results.anthropic = result;
        })
      );
    }

    if (models?.gemini) {
      promises.push(
        queryGemini(message, models.gemini).then((result) => {
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
