import type { PageInfoContent } from '@/components/common/PageInfoModal';

export const memoryManagementInfo: PageInfoContent = {
  title: 'Agent Memory Management',
  overview: `Manage long-term memories for AI agents to improve context retention and personalization.

Features:
• Memory Types: Facts, Preferences, Learned information, User-provided context
• Importance Levels: Rate memories 1-10 for retrieval prioritization
• CRUD Operations: Create, view, edit, and delete agent memories
• Filtering: Filter memories by type for easy management

Memory Types:
• Fact: Objective information about the user or context
• Preference: User preferences and settings
• Learned: Information the agent has learned from interactions
• User Provided: Explicit context provided by the user

How Memories Work:
1. Memories are retrieved when an agent starts a conversation
2. Higher importance memories are prioritized
3. Memories provide persistent context across sessions
4. Access counts track which memories are most useful`,

  architecture: `┌─────────────────────────────────────────────────────────────┐
│                Memory Management Page                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Agent Info + Back Link                             │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Filter by Type  |  + Add Memory                    │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Memory List                                        │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │ [Type Badge] Content... [Importance] [Edit] │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ agent-memories  │
                    │   endpoint      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │ agent_long_term │
                    │    _memory      │
                    └─────────────────┘`,

  tables: [
    {
      name: 'agent_long_term_memory',
      description: 'Persistent memories for agents across sessions',
      columns: ['memory_id', 'agent_id', 'tenant_id', 'content', 'memory_type', 'importance', 'access_count', 'last_accessed_at', 'created_at'],
      relationships: ['agent_id → agents.agent_id', 'tenant_id → tenants.tenant_id'],
    },
  ],

  apis: [
    {
      method: 'GET',
      path: '/api/agent-memories?agentId={id}',
      description: 'List all memories for an agent',
      responseBody: `{ "success": true, "memories": [...] }`,
    },
    {
      method: 'POST',
      path: '/api/agent-memories',
      description: 'Create a new memory for an agent',
      responseBody: `{ "success": true, "memory": {...} }`,
    },
    {
      method: 'PUT',
      path: '/api/agent-memories?id={id}',
      description: 'Update an existing memory',
      responseBody: `{ "success": true, "memory": {...} }`,
    },
    {
      method: 'DELETE',
      path: '/api/agent-memories?id={id}',
      description: 'Delete a memory',
      responseBody: `{ "success": true, "deleted": true }`,
    },
  ],
};
