/* eslint-disable no-console */
import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import type { AiChatJob } from './ai-chat-trigger';

const STORE_NAME = 'ai-chat-jobs';

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');

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

    return new Response(JSON.stringify({
      success: true,
      jobId: job.jobId,
      status: job.status,
      results: job.results,
      enabledProviders: job.enabledProviders,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error in ai-chat-status:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
