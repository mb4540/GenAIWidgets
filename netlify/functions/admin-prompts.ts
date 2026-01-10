import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface PromptRow {
  prompt_id: string;
  function_name: string;
  display_name: string;
  description: string | null;
  model_provider: string;
  model_name: string;
  system_prompt: string | null;
  user_prompt_template: string;
  temperature: string;
  max_tokens: number;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

interface PromptInput {
  functionName: string;
  displayName: string;
  description?: string;
  modelProvider: string;
  modelName: string;
  systemPrompt?: string;
  userPromptTemplate: string;
  temperature?: number;
  maxTokens?: number;
  isActive?: boolean;
}

function mapPromptRow(row: PromptRow) {
  return {
    id: row.prompt_id,
    functionName: row.function_name,
    displayName: row.display_name,
    description: row.description,
    modelProvider: row.model_provider,
    modelName: row.model_name,
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template,
    temperature: parseFloat(row.temperature),
    maxTokens: row.max_tokens,
    isActive: row.is_active,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return createErrorResponse(authResult.error, authResult.status);
  }

  const { context } = authResult;

  if (!context.isAdmin) {
    return createErrorResponse('Admin access required', 403);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);
  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      const functionName = url.searchParams.get('functionName');

      if (functionName) {
        const result = await sql`
          SELECT * FROM prompts WHERE function_name = ${functionName}
        ` as PromptRow[];

        const prompt = result[0];
        if (!prompt) {
          return createErrorResponse('Prompt not found', 404);
        }

        return createSuccessResponse({ prompt: mapPromptRow(prompt) });
      }

      const prompts = await sql`
        SELECT * FROM prompts ORDER BY display_name ASC
      ` as PromptRow[];

      return createSuccessResponse({
        prompts: prompts.map(mapPromptRow),
      });
    }

    if (req.method === 'POST') {
      const body = await req.json() as PromptInput;

      if (!body.functionName || !body.displayName || !body.modelProvider || !body.modelName || !body.userPromptTemplate) {
        return createErrorResponse('Missing required fields', 400);
      }

      const result = await sql`
        INSERT INTO prompts (
          function_name, display_name, description, model_provider, model_name,
          system_prompt, user_prompt_template, temperature, max_tokens, is_active, updated_by
        )
        VALUES (
          ${body.functionName},
          ${body.displayName},
          ${body.description || null},
          ${body.modelProvider},
          ${body.modelName},
          ${body.systemPrompt || null},
          ${body.userPromptTemplate},
          ${body.temperature ?? 0.7},
          ${body.maxTokens ?? 4096},
          ${body.isActive ?? true},
          ${context.userId}
        )
        RETURNING *
      ` as PromptRow[];

      const prompt = result[0];
      if (!prompt) {
        return createErrorResponse('Failed to create prompt', 500);
      }

      return createSuccessResponse({ prompt: mapPromptRow(prompt) }, 201);
    }

    if (req.method === 'PUT') {
      const body = await req.json() as PromptInput;

      if (!body.functionName) {
        return createErrorResponse('functionName is required', 400);
      }

      const result = await sql`
        UPDATE prompts SET
          display_name = COALESCE(${body.displayName || null}, display_name),
          description = ${body.description ?? null},
          model_provider = COALESCE(${body.modelProvider || null}, model_provider),
          model_name = COALESCE(${body.modelName || null}, model_name),
          system_prompt = ${body.systemPrompt ?? null},
          user_prompt_template = COALESCE(${body.userPromptTemplate || null}, user_prompt_template),
          temperature = COALESCE(${body.temperature ?? null}, temperature),
          max_tokens = COALESCE(${body.maxTokens ?? null}, max_tokens),
          is_active = COALESCE(${body.isActive ?? null}, is_active),
          updated_by = ${context.userId}
        WHERE function_name = ${body.functionName}
        RETURNING *
      ` as PromptRow[];

      const prompt = result[0];
      if (!prompt) {
        return createErrorResponse('Prompt not found', 404);
      }

      return createSuccessResponse({ prompt: mapPromptRow(prompt) });
    }

    if (req.method === 'DELETE') {
      const functionName = url.searchParams.get('functionName');

      if (!functionName) {
        return createErrorResponse('functionName query parameter required', 400);
      }

      const result = await sql`
        DELETE FROM prompts WHERE function_name = ${functionName}
        RETURNING prompt_id
      ` as { prompt_id: string }[];

      if (result.length === 0) {
        return createErrorResponse('Prompt not found', 404);
      }

      return createSuccessResponse({ deleted: true });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error in admin-prompts:', error);
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return createErrorResponse('A prompt with this function name already exists', 409);
    }
    return createErrorResponse('Internal server error', 500);
  }
}
