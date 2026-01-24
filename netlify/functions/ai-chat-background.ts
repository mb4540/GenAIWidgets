/* eslint-disable no-console */
import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { AiChatJob } from './ai-chat-trigger';

type Provider = 'openai' | 'anthropic' | 'gemini';

interface ProviderResult {
  ok: boolean;
  text?: string;
  error?: string;
}

const STORE_NAME = 'ai-chat-jobs';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

async function queryOpenAI(message: string, model: string): Promise<ProviderResult> {
  try {
    const openai = new OpenAI();
    const isGpt5OrNewer = model.startsWith('gpt-5') || model.startsWith('gpt-4.1') || model.startsWith('o3') || model.startsWith('o4');
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: message }],
      ...(isGpt5OrNewer ? { max_completion_tokens: 1024 } : { max_tokens: 1024 }),
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
          contents: [{ role: 'user', parts: [{ text: message }] }],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      return { ok: false, error: `Gemini error: ${response.status} - ${errorData}` };
    }

    const data = await response.json() as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response';
    return { ok: true, text };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, error: `Gemini error: ${errorMessage}` };
  }
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as { jobId: string };
    const { jobId } = body;

    if (!jobId) {
      return new Response(JSON.stringify({ success: false, error: 'jobId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const store = getStore(STORE_NAME);
    const job = await store.get(jobId, { type: 'json' }) as AiChatJob | null;

    if (!job) {
      return new Response(JSON.stringify({ success: false, error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update status to processing
    job.status = 'processing';
    await store.setJSON(jobId, job);

    const { message, models, enabledProviders } = job;

    // Process each enabled provider and update results incrementally
    const providerFunctions: Record<Provider, (msg: string, model: string) => Promise<ProviderResult>> = {
      openai: queryOpenAI,
      anthropic: queryAnthropic,
      gemini: queryGemini,
    };

    // Process providers in parallel
    const promises = enabledProviders.map(async (provider) => {
      const model = models[provider];
      if (!model) {
        job.results[provider] = { ok: false, error: `No model selected for ${provider}` };
        return;
      }

      const queryFn = providerFunctions[provider];
      if (!queryFn) {
        job.results[provider] = { ok: false, error: `Unknown provider: ${provider}` };
        return;
      }

      console.log(`Processing ${provider} with model ${model}`);
      const result = await queryFn(message, model);
      job.results[provider] = result;

      // Update job with partial results
      await store.setJSON(jobId, job);
      console.log(`Completed ${provider}: ${result.ok ? 'success' : result.error}`);
    });

    await Promise.all(promises);

    // Mark job as completed
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    await store.setJSON(jobId, job);

    console.log(`Job ${jobId} completed`);

    return new Response(JSON.stringify({ success: true, message: 'Processing complete' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-chat-background:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
