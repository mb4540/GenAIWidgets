import type { PageInfoContent } from '@/components/common/PageInfoModal';

export const debugPanelInfo: PageInfoContent = {
  title: 'Debug Panel',
  overview: `Real-time debugging interface for monitoring agent chat sessions.

Sections:
• Session Memory: View execution plans and scratchpad data
• Session Messages: All messages in the conversation with role and step info
• API Requests: Live capture of all API calls made during the session

Features:
• Auto-refresh: Data updates when the panel is opened
• Manual refresh: Click the refresh button to update data
• Collapsible sections: Expand/collapse each section as needed
• Download: Export all debug data to a text file

How to Use:
1. Open the debug panel during an agent chat session
2. View session memory to see the agent's execution plan
3. Monitor messages to track conversation flow
4. Check API requests to debug any issues

Color Coding:
• Blue: User messages and requests
• Green: Successful responses
• Purple: Tool calls
• Red: Errors`,

  architecture: `┌─────────────────────────────────────────────────────────────┐
│                      Debug Panel                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Header: Refresh | Download | Info | Close          │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Session Memory (collapsible)                       │    │
│  │  - execution_plan                                   │    │
│  │  - scratchpad                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Session Messages (collapsible)                     │    │
│  │  - user/assistant/tool messages                     │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  API Requests (collapsible)                         │    │
│  │  - request/response/error entries                   │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Footer: Session ID                                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘`,

  tables: [
    {
      name: 'agent_session_memory',
      description: 'Short-term working memory for agent sessions',
      columns: ['memory_id', 'session_id', 'memory_key', 'memory_value', 'created_at', 'updated_at'],
      relationships: ['session_id → agent_sessions.session_id'],
    },
    {
      name: 'session_messages',
      description: 'Messages within agent chat sessions',
      columns: ['message_id', 'session_id', 'step_number', 'role', 'content', 'tool_name', 'tool_input', 'tool_output'],
      relationships: ['session_id → agent_sessions.session_id'],
    },
  ],

  apis: [
    {
      method: 'GET',
      path: '/api/agent-sessions?id={sessionId}',
      description: 'Fetch session details and messages',
      responseBody: `{ "success": true, "session": {...}, "messages": [...] }`,
    },
    {
      method: 'GET',
      path: '/api/session-memory?sessionId={id}',
      description: 'Fetch session memory (execution plan, scratchpad)',
      responseBody: `{ "success": true, "memories": [...] }`,
    },
  ],
};
