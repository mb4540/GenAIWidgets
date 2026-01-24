import type { PageInfoContent } from '@/components/common/PageInfoModal';

export const agentChatInfo: PageInfoContent = {
  title: 'Agent Chat',
  overview: `Interactive chat interface for AI agents with tool execution capabilities.

Features:
• Agent Selection: Choose from configured agents in the sidebar
• Chat History: View and continue previous agent conversations
• Tool Execution: Agents can use assigned tools to complete tasks
• Debug Panel: Monitor agent reasoning, tool calls, and execution plans

How It Works:
1. Select an agent from the sidebar or start a new chat
2. Send a message describing your task
3. The agent processes your request, potentially using tools
4. View responses and tool outputs in the chat

Agent Capabilities:
• Autonomous task execution with planning
• Tool usage (file operations, web search, weather, etc.)
• Long-term memory for context retention
• Session-based conversation history`,

  architecture: `┌─────────────────────────────────────────────────────────────┐
│                     Agent Chat Page                          │
│  ┌──────────────┐  ┌────────────────────────────────────┐   │
│  │ Chat History │  │           Chat Area                │   │
│  │   Sidebar    │  │  ┌─────────────────────────────┐   │   │
│  │              │  │  │      Messages Display       │   │   │
│  │ [Agent 1]    │  │  │   (user/assistant/tool)     │   │   │
│  │  └─Session 1 │  │  └─────────────────────────────┘   │   │
│  │  └─Session 2 │  │  ┌─────────────────────────────┐   │   │
│  │ [Agent 2]    │  │  │      Input + Send           │   │   │
│  └──────────────┘  │  └─────────────────────────────┘   │   │
│                    └────────────────────────────────────┘   │
│                    ┌────────────────────────────────────┐   │
│                    │         Debug Panel               │   │
│                    │  Session Memory | Messages | API  │   │
│                    └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────────┐ ┌─────────────┐ ┌─────────────┐
    │  agent-chat     │ │agent-sessions│ │ tool-*      │
    │  (main loop)    │ │  (CRUD)     │ │ endpoints   │
    └────────┬────────┘ └──────┬──────┘ └─────────────┘
             │                 │
             ▼                 ▼
    ┌─────────────────────────────────┐
    │         PostgreSQL              │
    │  agents, agent_sessions         │
    │  session_messages, agent_tools  │
    └─────────────────────────────────┘`,

  tables: [
    {
      name: 'agents',
      description: 'Configured AI agents with system prompts and settings',
      columns: ['agent_id', 'tenant_id', 'name', 'description', 'system_prompt', 'model_provider', 'model_name', 'is_active'],
      relationships: ['tenant_id → tenants.tenant_id'],
    },
    {
      name: 'agent_sessions',
      description: 'Chat sessions between users and agents',
      columns: ['session_id', 'agent_id', 'user_id', 'tenant_id', 'title', 'status', 'current_step', 'goal_met'],
      relationships: ['agent_id → agents.agent_id', 'user_id → users.user_id'],
    },
    {
      name: 'session_messages',
      description: 'Messages within agent chat sessions',
      columns: ['message_id', 'session_id', 'step_number', 'role', 'content', 'tool_name', 'tool_input', 'tool_output'],
      relationships: ['session_id → agent_sessions.session_id'],
    },
    {
      name: 'agent_session_memory',
      description: 'Short-term working memory (execution plans, scratchpad)',
      columns: ['memory_id', 'session_id', 'memory_key', 'memory_value'],
      relationships: ['session_id → agent_sessions.session_id'],
    },
  ],

  apis: [
    {
      method: 'POST',
      path: '/api/agent-chat',
      description: 'Send a message to an agent and get response with tool execution',
      responseBody: `{ "success": true, "response": "...", "toolCalls": [...] }`,
    },
    {
      method: 'GET',
      path: '/api/agent-sessions',
      description: 'List agent sessions, optionally filtered by agent',
      responseBody: `{ "success": true, "sessions": [...] }`,
    },
    {
      method: 'GET',
      path: '/api/agent-sessions?id={id}',
      description: 'Get session with all messages',
      responseBody: `{ "success": true, "session": {...}, "messages": [...] }`,
    },
  ],
};
