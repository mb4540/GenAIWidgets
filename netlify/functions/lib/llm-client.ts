import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { ModelProvider } from '../../../src/types/agent';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMResponse {
  content: string | null;
  tool_calls: ToolCall[] | null;
  reasoning: string | null;
  tokens_used: number;
  finish_reason: string;
}

export interface LLMClientOptions {
  provider: ModelProvider;
  model: string;
  temperature: number;
  maxTokens?: number;
}

export async function callLLM(
  messages: LLMMessage[],
  tools: ToolDefinition[],
  options: LLMClientOptions
): Promise<LLMResponse> {
  switch (options.provider) {
    case 'openai':
      return callOpenAI(messages, tools, options);
    case 'anthropic':
      return callAnthropic(messages, tools, options);
    case 'gemini':
      return callGemini(messages, tools, options);
    default:
      throw new Error(`Unsupported provider: ${options.provider}`);
  }
}

async function callOpenAI(
  messages: LLMMessage[],
  tools: ToolDefinition[],
  options: LLMClientOptions
): Promise<LLMResponse> {
  const client = new OpenAI();

  const openaiMessages = messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'tool' as const,
        content: m.content,
        tool_call_id: m.tool_call_id || '',
      };
    }
    if (m.tool_calls) {
      return {
        role: 'assistant' as const,
        content: m.content || null,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: tc.function,
        })),
      };
    }
    return {
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    };
  });

  const openaiTools = tools.length > 0 ? tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  })) : undefined;

  const response = await client.chat.completions.create({
    model: options.model,
    messages: openaiMessages,
    tools: openaiTools,
    temperature: options.temperature,
    max_tokens: options.maxTokens || 4096,
  });

  const choice = response.choices[0];
  if (!choice) {
    throw new Error('No response from OpenAI');
  }

  const mappedToolCalls = choice.message.tool_calls?.map((tc) => {
    const toolCall = tc as { id: string; type: string; function: { name: string; arguments: string } };
    return {
      id: toolCall.id,
      type: 'function' as const,
      function: {
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      },
    };
  }) || null;

  return {
    content: choice.message.content,
    tool_calls: mappedToolCalls,
    reasoning: null,
    tokens_used: response.usage?.total_tokens || 0,
    finish_reason: choice.finish_reason || 'stop',
  };
}

async function callAnthropic(
  messages: LLMMessage[],
  tools: ToolDefinition[],
  options: LLMClientOptions
): Promise<LLMResponse> {
  const client = new Anthropic();

  const systemMessage = messages.find((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  const anthropicMessages = nonSystemMessages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'user' as const,
        content: [{
          type: 'tool_result' as const,
          tool_use_id: m.tool_call_id || '',
          content: m.content,
        }],
      };
    }
    if (m.tool_calls && m.tool_calls.length > 0) {
      return {
        role: 'assistant' as const,
        content: m.tool_calls.map((tc) => ({
          type: 'tool_use' as const,
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
        })),
      };
    }
    return {
      role: m.role as 'user' | 'assistant',
      content: m.content,
    };
  });

  const anthropicTools = tools.length > 0 ? tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  })) : undefined;

  const response = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens || 4096,
    system: systemMessage?.content || '',
    messages: anthropicMessages,
    tools: anthropicTools,
    temperature: options.temperature,
  });

  let content: string | null = null;
  const toolCalls: ToolCall[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      content = block.text;
    } else if (block.type === 'tool_use') {
      const toolUseBlock = block as { id: string; name: string; input: unknown };
      toolCalls.push({
        id: toolUseBlock.id,
        type: 'function',
        function: {
          name: toolUseBlock.name,
          arguments: JSON.stringify(toolUseBlock.input),
        },
      });
    }
  }

  return {
    content,
    tool_calls: toolCalls.length > 0 ? toolCalls : null,
    reasoning: null,
    tokens_used: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    finish_reason: response.stop_reason || 'end_turn',
  };
}

async function callGemini(
  messages: LLMMessage[],
  _tools: ToolDefinition[],
  options: LLMClientOptions
): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  const baseUrl = process.env.GOOGLE_GEMINI_BASE_URL;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  if (!baseUrl) {
    throw new Error('GOOGLE_GEMINI_BASE_URL not configured');
  }

  const systemMessage = messages.find((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  const geminiContents = nonSystemMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const requestBody: Record<string, unknown> = {
    contents: geminiContents,
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens || 4096,
    },
  };

  if (systemMessage?.content) {
    requestBody.systemInstruction = { parts: [{ text: systemMessage.content }] };
  }

  const response = await fetch(
    `${baseUrl}/v1beta/models/${options.model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Gemini error: ${response.status} - ${errorData}`);
  }

  interface GeminiResponse {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args: Record<string, unknown> };
        }>;
      };
      finishReason?: string;
    }>;
    usageMetadata?: { totalTokenCount?: number };
  }

  const data = await response.json() as GeminiResponse;

  let content: string | null = null;
  const toolCalls: ToolCall[] = [];

  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        content = part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args),
          },
        });
      }
    }
  }

  return {
    content,
    tool_calls: toolCalls.length > 0 ? toolCalls : null,
    reasoning: null,
    tokens_used: data.usageMetadata?.totalTokenCount || 0,
    finish_reason: data.candidates?.[0]?.finishReason || 'STOP',
  };
}
