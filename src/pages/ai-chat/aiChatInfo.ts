import type { PageInfoContent } from '@/components/common/PageInfoModal';

export const aiChatInfo: PageInfoContent = {
  title: 'AI Chat',
  overview: `Single-model AI chat interface with conversation history.

Features:
• Model Selection: Choose from OpenAI, Anthropic, or Google models
• Chat History: All conversations are saved and accessible from the sidebar
• Session Management: Create, view, and delete chat sessions

How It Works:
1. Click "New Chat" to start a conversation
2. Select your preferred AI provider and model
3. Send messages and receive AI responses
4. Switch between sessions using the sidebar

Supported Providers:
• OpenAI: GPT-4o, GPT-4o Mini, GPT-4.1, GPT-5, O3/O4 Mini
• Anthropic: Claude 3 Haiku, Claude 3.5/3.7 Sonnet, Claude 4.5
• Google: Gemini 2.0/2.5 Flash, Gemini 2.5 Pro`,

  architecture: `┌─────────────────────────────────────────────────────────────┐
│                       AI Chat Page                           │
│  ┌──────────────┐  ┌────────────────────────────────────┐   │
│  │ Chat History │  │           Chat Area                │   │
│  │   Sidebar    │  │  ┌─────────────────────────────┐   │   │
│  │              │  │  │      Messages Display       │   │   │
│  │ [Session 1]  │  │  └─────────────────────────────┘   │   │
│  │ [Session 2]  │  │  ┌─────────────────────────────┐   │   │
│  │ [+ New Chat] │  │  │      Input + Send           │   │   │
│  └──────────────┘  │  └─────────────────────────────┘   │   │
│                    └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────────┐ ┌─────────────┐ ┌─────────────┐
    │ai-chat-sessions │ │ai-chat-single│ │  AI APIs   │
    │   (CRUD)        │ │  (chat)     │ │OpenAI/etc  │
    └────────┬────────┘ └──────┬──────┘ └─────────────┘
             │                 │
             ▼                 ▼
    ┌─────────────────────────────────┐
    │         PostgreSQL              │
    │  ai_chat_sessions               │
    │  ai_chat_messages               │
    └─────────────────────────────────┘`,

  tables: [
    {
      name: 'ai_chat_sessions',
      description: 'Stores AI chat session metadata',
      columns: ['session_id', 'tenant_id', 'user_id', 'title', 'model_provider', 'model_name', 'status', 'created_at', 'updated_at'],
      relationships: ['tenant_id → tenants.tenant_id', 'user_id → users.user_id'],
    },
    {
      name: 'ai_chat_messages',
      description: 'Stores messages within AI chat sessions',
      columns: ['message_id', 'session_id', 'role', 'content', 'tokens_used', 'created_at'],
      relationships: ['session_id → ai_chat_sessions.session_id'],
    },
  ],

  apis: [
    {
      method: 'GET',
      path: '/api/ai-chat-sessions',
      description: 'List all AI chat sessions for the current user',
      responseBody: `{ "success": true, "sessions": [...] }`,
    },
    {
      method: 'GET',
      path: '/api/ai-chat-sessions?id={id}',
      description: 'Get a specific session with all messages',
      responseBody: `{ "success": true, "session": {...}, "messages": [...] }`,
    },
    {
      method: 'POST',
      path: '/api/ai-chat-sessions',
      description: 'Create a new AI chat session',
      responseBody: `{ "success": true, "session": {...} }`,
    },
    {
      method: 'POST',
      path: '/api/ai-chat-single',
      description: 'Send a message and get AI response',
      responseBody: `{ "success": true, "message": { "role": "assistant", "content": "...", "tokens_used": 150 } }`,
    },
  ],
};
