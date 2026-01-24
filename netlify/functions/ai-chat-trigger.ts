/* eslint-disable no-console */
import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { v4 as uuid } from 'uuid';

type Provider = 'openai' | 'anthropic' | 'gemini';

interface AiChatTriggerRequest {
  message: string;
  models: Record<Provider, string>;
  enabledProviders: Provider[];
}

interface ProviderResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export interface AiChatJob {
  jobId: string;
  message: string;
  enabledProviders: Provider[];
  models: Record<string, string>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results: {
    openai?: ProviderResult;
    anthropic?: ProviderResult;
    gemini?: ProviderResult;
  };
  createdAt: string;
  completedAt?: string;
}

const STORE_NAME = 'ai-chat-jobs';

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
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as AiChatTriggerRequest;
    const { message, models, enabledProviders } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!enabledProviders || enabledProviders.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'At least one provider must be enabled' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const jobId = uuid();
    const job: AiChatJob = {
      jobId,
      message: message.trim(),
      enabledProviders,
      models: models || {},
      status: 'pending',
      results: {},
      createdAt: new Date().toISOString(),
    };

    // Store job in Netlify Blobs
    const store = getStore(STORE_NAME);
    await store.setJSON(jobId, job);

    // Trigger background worker
    const workerUrl = new URL(req.url);
    workerUrl.pathname = '/.netlify/functions/ai-chat-background';

    try {
      const workerResponse = await fetch(workerUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      });
      console.log(`AI chat worker trigger response: ${workerResponse.status}`);
    } catch (err) {
      console.error('Failed to trigger AI chat background worker:', err);
    }

    return new Response(JSON.stringify({ success: true, jobId }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error in ai-chat-trigger:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
