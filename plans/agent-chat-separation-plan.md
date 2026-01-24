# Agent Chat Separation Plan

## Overview
Separate Agent Management from Agent Chat into distinct pages with their own navigation items. Add a Chat History sidebar to the Agent Chat page.

## Current State
- `/agent-chat` → `AgentManagementPage` (shows agent cards with CRUD operations)
- `/agent-chat/chat` → `AgentChatPage` (chat interface, requires `?agentId=` param)
- Nav menu has "Agent Chat" pointing to `/agent-chat` (which is actually management)

## Target State

### Navigation Structure
```
Nav Menu:
├── Agent Management  → /agents           (CRUD for agents)
├── Agent Chat        → /agent-chat       (Chat interface with history sidebar)
├── Agent Tools       → /agents/tools     (Tool management)
```

### Routes
| Route | Component | Description |
|-------|-----------|-------------|
| `/agents` | `AgentManagementPage` | Agent CRUD (create, edit, delete agents) |
| `/agents/tools` | `ToolsManagementPage` | Tool management |
| `/agents/memories` | `MemoryManagementPage` | Memory management |
| `/agent-chat` | `AgentChatPage` | Chat with history sidebar |

### Agent Chat Page Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Agent Chat                                          │
├──────────────┬──────────────────────────────────────────────┤
│ Chat History │ Chat Area                                    │
│              │                                              │
│ [Agent 1]    │ ┌──────────────────────────────────────────┐ │
│  - Session 1 │ │ Messages                                 │ │
│  - Session 2 │ │                                          │ │
│              │ │                                          │ │
│ [Agent 2]    │ │                                          │ │
│  - Session 1 │ │                                          │ │
│              │ ├──────────────────────────────────────────┤ │
│ + New Chat   │ │ Input                                    │ │
└──────────────┴──────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Route Restructuring
1. Update `App.tsx` routes:
   - `/agents` → `AgentManagementPage`
   - `/agents/tools` → `ToolsManagementPage`
   - `/agents/memories` → `MemoryManagementPage`
   - `/agent-chat` → `AgentChatPage` (no longer requires agentId param)

2. Update `AppLayout.tsx` nav items:
   - Add "Agent Management" → `/agents`
   - Keep "Agent Chat" → `/agent-chat`
   - Move "Agent Tools" → `/agents/tools`

### Phase 2: Chat History Sidebar Component
1. Create `ChatHistorySidebar.tsx` component:
   - Fetch all agents for the user
   - For each agent, fetch sessions (grouped by agent)
   - Display as expandable list
   - "New Chat" button per agent
   - Click session to load that chat

2. API requirements:
   - `GET /api/agent-sessions?agentId={id}` - already exists
   - `GET /api/agents` - already exists

### Phase 3: Refactor AgentChatPage
1. Remove requirement for `agentId` query param
2. Add ChatHistorySidebar to left side
3. Show "Select a chat" placeholder when no session selected
4. Load session messages when session selected from sidebar
5. Support creating new session for any agent

### Phase 4: Update AgentManagementPage
1. Remove "Chat" button from agent cards (chat is now separate)
2. Keep "Memories" button (links to `/agents/memories?agentId=`)
3. Focus purely on agent CRUD operations

## Files to Modify

### New Files
- `src/components/agent-chat/ChatHistorySidebar.tsx`

### Modified Files
- `src/App.tsx` - Update routes
- `src/components/layout/AppLayout.tsx` - Update nav items
- `src/pages/agent-chat/AgentChatPage.tsx` - Add sidebar, remove agentId requirement
- `src/pages/agent-chat/AgentManagementPage.tsx` - Remove chat button
- `src/pages/agent-chat/components/AgentList.tsx` - Remove chat button from cards

## Data Flow

### Chat History Sidebar
```
1. On mount: Fetch all agents
2. For each agent: Fetch sessions (lazy load on expand)
3. Display: Agent name → Session list (with timestamps/titles)
4. On session click: Set selectedSession, load messages
5. On "New Chat": Create new session for that agent
```

### Session Selection
```
1. User clicks session in sidebar
2. Update URL: /agent-chat?sessionId={id}
3. Fetch session details and messages
4. Display in chat area
```

## Testing Checklist
- [ ] Navigate to Agent Management, verify CRUD works
- [ ] Navigate to Agent Chat, verify sidebar shows agents
- [ ] Expand agent, verify sessions load
- [ ] Click session, verify messages load
- [ ] Click "New Chat", verify new session created
- [ ] Send message, verify it appears in chat
- [ ] Refresh page with sessionId param, verify session loads
- [ ] Verify Agent Tools still accessible at new route
