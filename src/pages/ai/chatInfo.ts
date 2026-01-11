import type { PageInfoContent } from '@/components/common/PageInfoModal';

export const chatInfo: PageInfoContent = {
  title: 'AI Gateway Chat',
  overview: `The AI Gateway Chat provides a unified interface for interacting with multiple Large Language Model (LLM) providers through a single API gateway.

Key Features:
• Multi-Model Support: Switch between different AI models (GPT-4, Claude, Gemini, etc.)
• Conversation History: Messages are persisted and can be continued across sessions
• Streaming Responses: Real-time token streaming for responsive user experience
• Temperature Control: Adjust creativity/randomness of model responses
• System Prompts: Configure custom system instructions for specialized behavior

The gateway abstracts away provider-specific APIs, allowing seamless model switching without code changes. All conversations are tenant-scoped and stored securely.

Use Cases:
• Testing different models for quality comparison
• Prototyping AI-powered features
• Internal knowledge assistant
• Customer support automation testing`,

  architecture: `┌─────────────────────────────────────────────────────────────┐
│                    AI Gateway Chat UI                        │
│  ┌──────────────┐  ┌────────────────────────────────────┐   │
│  │Model Selector│  │         Chat Messages              │   │
│  │ Temperature  │  │  ┌─────────────────────────────┐   │   │
│  │   Controls   │  │  │ User: Hello                 │   │   │
│  └──────────────┘  │  │ Assistant: Hi! How can I... │   │   │
│                    │  └─────────────────────────────┘   │   │
│                    │  ┌─────────────────────────────┐   │   │
│                    │  │     Message Input           │   │   │
│                    │  └─────────────────────────────┘   │   │
│                    └────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    Netlify Function   │
                    │      ai-gateway       │
                    └───────────┬───────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
   ┌───────────┐         ┌───────────┐         ┌───────────┐
   │  OpenAI   │         │  Anthropic│         │  Google   │
   │   API     │         │    API    │         │  Gemini   │
   └───────────┘         └───────────┘         └───────────┘`,

  tables: [
    {
      name: 'conversations',
      description: 'Stores chat conversation metadata',
      columns: ['conversation_id', 'tenant_id', 'user_id', 'title', 'model_name', 'created_at', 'updated_at'],
      relationships: ['tenant_id → tenants.tenant_id', 'user_id → users.user_id'],
    },
    {
      name: 'messages',
      description: 'Individual messages within conversations',
      columns: ['message_id', 'conversation_id', 'role', 'content', 'model_name', 'tokens_used', 'created_at'],
      relationships: ['conversation_id → conversations.conversation_id'],
    },
    {
      name: 'prompts',
      description: 'Configurable system prompts for AI interactions',
      columns: ['prompt_id', 'prompt_name', 'system_prompt', 'user_prompt_template', 'model_name', 'temperature', 'max_tokens'],
      relationships: [],
    },
  ],

  apis: [
    {
      method: 'POST',
      path: '/api/ai-gateway',
      description: 'Send a message to the AI gateway and receive a streaming or complete response.',
      requestBody: `{
  "messages": [
    { "role": "user", "content": "Hello, how are you?" }
  ],
  "model": "gpt-4",
  "temperature": 0.7,
  "stream": true
}`,
      responseBody: `{
  "success": true,
  "response": "I'm doing well, thank you for asking!",
  "model": "gpt-4",
  "tokensUsed": { "prompt": 12, "completion": 15 }
}`,
    },
    {
      method: 'GET',
      path: '/api/conversations',
      description: 'List all conversations for the current user.',
      responseBody: `{
  "success": true,
  "conversations": [
    { "id": "uuid", "title": "Chat about AI", "model": "gpt-4", "updatedAt": "..." }
  ]
}`,
    },
    {
      method: 'GET',
      path: '/api/models',
      description: 'List available AI models from the gateway.',
      responseBody: `{
  "success": true,
  "models": [
    { "id": "gpt-4", "name": "GPT-4", "provider": "openai" },
    { "id": "claude-3", "name": "Claude 3", "provider": "anthropic" }
  ]
}`,
    },
  ],
};
