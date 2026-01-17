# Agent Mode Chat - Execution Plan

## How to Use This Plan

This execution plan breaks down the Agent Mode Chat feature into testable phases. Follow these rules:

### Progress Tracking

1. **Before starting a phase:** Mark the phase status as `🔄 IN PROGRESS`
2. **After completing each task:** Change `[ ]` to `[x]`
3. **After passing all tests:** Mark the phase status as `✅ COMPLETED`
4. **If blocked:** Mark as `⚠️ BLOCKED` and document the issue
5. **Commit after each phase** with message: `feat(agent-mode): Complete Phase X - [Phase Name]`

### Phase Status Legend

| Status           | Meaning                                  |
|------------------|------------------------------------------|
| `⬜ NOT STARTED` | Phase has not begun                      |
| `🔄 IN PROGRESS` | Currently working on this phase          |
| `✅ COMPLETED`   | All tasks done, all tests passing        |
| `⚠️ BLOCKED`     | Cannot proceed, needs resolution         |
| `⏭️ SKIPPED`     | Intentionally skipped (document reason)  |

---

## Overall Progress

| Phase | Name                       | Status         | Completion Date |
|-------|----------------------------|----------------|-----------------|
| 1     | Database Schema            | ✅ COMPLETED   | 2026-01-17      |
| 2     | Agent CRUD API             | ✅ COMPLETED   | 2026-01-17      |
| 3     | Agent Management UI        | ✅ COMPLETED   | 2026-01-17      |
| 4     | Tools & MCP Infrastructure | ⬜ NOT STARTED | -               |
| 5     | Session & Memory API       | ⬜ NOT STARTED | -               |
| 6     | Agent Loop (Core Engine)   | ⬜ NOT STARTED | -               |
| 7     | Streaming Infrastructure   | ⬜ NOT STARTED | -               |
| 8     | Chat Interface UI          | ⬜ NOT STARTED | -               |
| 9     | Memory Management UI       | ⬜ NOT STARTED | -               |
| 10    | Integration & Polish       | ⬜ NOT STARTED | -               |

---

## Phase 1: Database Schema

**Status:** ✅ COMPLETED

**Goal:** Create all database tables required for Agent Mode.

### Tasks

- [x] 1.1 Review `/db_ref.md` to understand existing schema
- [x] 1.2 Create `migrations/009_agents_table.sql`
  - [x] `agents` table with all columns
  - [x] Foreign keys to `tenants` and `users`
  - [x] Indexes on `tenant_id`
  - [x] Unique constraint on `(tenant_id, name)`
- [x] 1.3 Create `migrations/010_agent_sessions_tables.sql`
  - [x] `agent_sessions` table
  - [x] `agent_session_messages` table
  - [x] All foreign keys and indexes
- [x] 1.4 Create `migrations/011_agent_memory_table.sql`
  - [x] `agent_long_term_memory` table
  - [x] Foreign keys and indexes
- [x] 1.5 Create `migrations/012_agent_tools_tables.sql`
  - [x] `agent_tools` table
  - [x] `agent_tool_assignments` table
  - [x] Foreign keys and indexes
- [x] 1.6 Create `migrations/013_mcp_servers_table.sql`
  - [x] `mcp_servers` table
  - [x] Foreign keys and indexes
- [x] 1.7 Run all migrations locally
- [x] 1.8 Update `/db_ref.md` with new tables
- [x] 1.9 Create TypeScript types in `src/types/agent.ts`

### Test Criteria

```bash
# Run migrations
psql $DATABASE_URL -f migrations/009_agents_table.sql
psql $DATABASE_URL -f migrations/010_agent_sessions_tables.sql
psql $DATABASE_URL -f migrations/011_agent_memory_table.sql
psql $DATABASE_URL -f migrations/012_agent_tools_tables.sql
psql $DATABASE_URL -f migrations/013_mcp_servers_table.sql

# Verify tables exist
psql $DATABASE_URL -c "\dt agent*"
```

**Pass Criteria:**
- [ ] All 6 tables created without errors
- [ ] All foreign key constraints working
- [ ] `/db_ref.md` updated
- [ ] TypeScript types compile without errors

### Notes

_Document any issues or decisions made during this phase:_

---

## Phase 2: Agent CRUD API

**Status:** ✅ COMPLETED

**Goal:** Implement backend API for agent management.

### Tasks

- [x] 2.1 Create `netlify/functions/agents.ts`
  - [x] GET `/api/agents` - List agents for tenant
  - [x] GET `/api/agents/:id` - Get single agent
  - [x] POST `/api/agents` - Create agent
  - [x] PUT `/api/agents/:id` - Update agent
  - [x] DELETE `/api/agents/:id` - Delete agent
- [x] 2.2 Add authentication middleware
- [x] 2.3 Add input validation
- [x] 2.4 Add tenant isolation checks
- [x] 2.5 Create unit tests for agents API

### Test Criteria

```bash
# Start dev server
netlify dev

# Test endpoints manually or with curl
curl -X GET http://localhost:8888/api/agents \
  -H "Authorization: Bearer $TOKEN"

curl -X POST http://localhost:8888/api/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Agent","goal":"Help users","system_prompt":"You are helpful","model_provider":"openai","model_name":"gpt-4o"}'
```

**Pass Criteria:**
- [ ] All 5 CRUD endpoints working
- [ ] Authentication required for all endpoints
- [ ] Tenant isolation enforced
- [ ] Input validation returns proper errors
- [ ] Unit tests passing

### Notes

_Document any issues or decisions made during this phase:_

---

## Phase 3: Agent Management UI

**Status:** ✅ COMPLETED

**Goal:** Create UI for managing agents (create, edit, delete, list).

### Tasks

- [x] 3.1 Create `src/pages/agent-chat/AgentManagementPage.tsx`
- [x] 3.2 Create `src/pages/agent-chat/components/AgentList.tsx`
  - [x] Display agents in cards/table
  - [x] Search/filter functionality
  - [x] Status indicators
- [x] 3.3 Create `src/pages/agent-chat/components/AgentForm.tsx`
  - [x] Name, description, goal fields
  - [x] System prompt textarea
  - [x] Model provider/name selectors
  - [x] Max steps, temperature sliders
  - [x] Form validation
- [x] 3.4 Create `src/pages/agent-chat/components/AgentDetailModal.tsx`
- [x] 3.5 Add delete confirmation dialog
- [x] 3.6 Add route to `App.tsx`
- [x] 3.7 Add navigation link to sidebar

### Test Criteria

```bash
netlify dev
# Navigate to /agent-chat/agents
```

**Pass Criteria:**
- [ ] Agent list displays correctly
- [ ] Can create new agent via form
- [ ] Can edit existing agent
- [ ] Can delete agent with confirmation
- [ ] Form validation works
- [ ] Navigation link visible in sidebar
- [ ] Responsive design works

### Notes

_Document any issues or decisions made during this phase:_

---

## Phase 4: Tools & MCP Infrastructure

**Status:** ⬜ NOT STARTED

**Goal:** Implement tools registry and MCP server management.

### Tasks

- [ ] 4.1 Create `netlify/functions/agent-tools.ts`
  - [ ] CRUD for tools
  - [ ] Tool assignment to agents
- [ ] 4.2 Create `netlify/functions/mcp-servers.ts`
  - [ ] CRUD for MCP servers
  - [ ] Health check endpoint
  - [ ] Credential encryption/decryption
- [ ] 4.3 Add `NETLIFY_ENCRYPTION_KEY` to environment
- [ ] 4.4 Create encryption utility in `netlify/functions/lib/encryption.ts`
- [ ] 4.5 Create `src/pages/agent-chat/ToolsManagementPage.tsx`
- [ ] 4.6 Create `src/pages/agent-chat/components/ToolForm.tsx`
- [ ] 4.7 Create `src/pages/agent-chat/components/McpServerForm.tsx`
- [ ] 4.8 Create tool testing interface

### Test Criteria

```bash
# Test MCP server health check
curl -X POST http://localhost:8888/api/mcp-servers/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"server_url":"https://example-mcp.com"}'
```

**Pass Criteria:**
- [ ] Can create/edit/delete tools
- [ ] Can create/edit/delete MCP servers
- [ ] Credentials are encrypted in database
- [ ] Health check works for MCP servers
- [ ] Tool assignment to agents works
- [ ] UI displays tools correctly

### Notes

_Document any issues or decisions made during this phase:_

---

## Phase 5: Session & Memory API

**Status:** ⬜ NOT STARTED

**Goal:** Implement session management and long-term memory APIs.

### Tasks

- [ ] 5.1 Create `netlify/functions/agent-sessions.ts`
  - [ ] GET `/api/agents/:id/sessions` - List sessions
  - [ ] GET `/api/agent-sessions/:id` - Get session with messages
  - [ ] POST `/api/agents/:id/sessions` - Start new session
  - [ ] POST `/api/agent-sessions/:id/cancel` - Cancel session
  - [ ] DELETE `/api/agent-sessions/:id` - Delete session
  - [ ] GET `/api/agent-sessions/:id/status` - Poll status
- [ ] 5.2 Create `netlify/functions/agent-memories.ts`
  - [ ] GET `/api/agents/:id/memories` - List memories
  - [ ] POST `/api/agents/:id/memories` - Add memory
  - [ ] PUT `/api/agent-memories/:id` - Update memory
  - [ ] DELETE `/api/agent-memories/:id` - Delete memory
- [ ] 5.3 Add session message storage logic
- [ ] 5.4 Add memory retrieval by relevance (basic)

### Test Criteria

```bash
# Create a session
curl -X POST http://localhost:8888/api/agents/{agentId}/sessions \
  -H "Authorization: Bearer $TOKEN"

# Add a memory
curl -X POST http://localhost:8888/api/agents/{agentId}/memories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"User prefers concise answers","memory_type":"preference"}'
```

**Pass Criteria:**
- [ ] Can create/list/delete sessions
- [ ] Can add/edit/delete memories
- [ ] Session messages are stored correctly
- [ ] Memory retrieval works
- [ ] Tenant isolation enforced

### Notes

_Document any issues or decisions made during this phase:_

---

## Phase 6: Agent Loop (Core Engine)

**Status:** ⬜ NOT STARTED

**Goal:** Implement the core agent decision loop as a background function.

### Tasks

- [ ] 6.1 Create `netlify/functions/lib/llm-client.ts`
  - [ ] OpenAI integration via AI Gateway
  - [ ] Anthropic integration via AI Gateway
  - [ ] Gemini integration via AI Gateway
  - [ ] Error handling for rate limits
- [ ] 6.2 Create `netlify/functions/lib/prompt-utils.ts`
  - [ ] Prompt sanitization
  - [ ] Context building
  - [ ] Tool schema formatting
- [ ] 6.3 Create `netlify/functions/agent-loop-background.ts`
  - [ ] Main agent loop logic
  - [ ] Tool execution dispatcher
  - [ ] Memory retrieval integration
  - [ ] Step tracking and limits
  - [ ] Goal completion detection
- [ ] 6.4 Create `netlify/functions/lib/mcp-client.ts`
  - [ ] MCP server communication
  - [ ] Tool invocation
- [ ] 6.5 Implement memory extraction at session end
- [ ] 6.6 Add comprehensive logging (sanitized)

### Test Criteria

```bash
# Trigger agent loop manually
curl -X POST http://localhost:8888/api/agent-sessions/{sessionId}/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"What is 2+2?"}'

# Check session status
curl http://localhost:8888/api/agent-sessions/{sessionId}/status \
  -H "Authorization: Bearer $TOKEN"
```

**Pass Criteria:**
- [ ] Agent receives message and processes it
- [ ] LLM is called via AI Gateway
- [ ] Agent can decide to use tools
- [ ] Tool results are fed back to agent
- [ ] Agent can complete and mark goal_met
- [ ] Max steps limit is enforced
- [ ] Memories are retrieved during loop
- [ ] New memories are suggested at session end

### Notes

_Document any issues or decisions made during this phase:_

---

## Phase 7: Streaming Infrastructure

**Status:** ⬜ NOT STARTED

**Goal:** Implement real-time streaming of agent responses and tool results.

### Tasks

- [ ] 7.1 Research SSE vs WebSocket for Netlify Functions
- [ ] 7.2 Create streaming endpoint `netlify/functions/agent-stream.ts`
  - [ ] Server-Sent Events (SSE) implementation
  - [ ] Event types: `reasoning`, `tool_call`, `tool_result`, `response`, `done`
- [ ] 7.3 Update agent loop to emit events
- [ ] 7.4 Create `src/hooks/useAgentStream.ts`
  - [ ] SSE client connection
  - [ ] Event parsing
  - [ ] Reconnection logic
- [ ] 7.5 Create event type definitions

### Test Criteria

```bash
# Test SSE endpoint
curl -N http://localhost:8888/api/agent-sessions/{sessionId}/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"
```

**Pass Criteria:**
- [ ] SSE connection established
- [ ] Events stream in real-time
- [ ] All event types working
- [ ] Reconnection works after disconnect
- [ ] Events are properly typed

### Notes

_Document any issues or decisions made during this phase:_

---

## Phase 8: Chat Interface UI

**Status:** ⬜ NOT STARTED

**Goal:** Create the main chat interface for interacting with agents.

### Tasks

- [ ] 8.1 Create `src/pages/agent-chat/AgentChatPage.tsx`
- [ ] 8.2 Create `src/pages/agent-chat/components/AgentSelector.tsx`
- [ ] 8.3 Create `src/pages/agent-chat/components/SessionList.tsx`
  - [ ] List of sessions
  - [ ] New session button
  - [ ] Session status indicators
- [ ] 8.4 Create `src/pages/agent-chat/components/ChatMessage.tsx`
  - [ ] User message style
  - [ ] Assistant message style
  - [ ] System message style
- [ ] 8.5 Create `src/pages/agent-chat/components/ToolExecutionCard.tsx`
  - [ ] Collapsible tool call display
  - [ ] Input/output visualization
  - [ ] Loading state during execution
- [ ] 8.6 Create `src/pages/agent-chat/components/ReasoningDisplay.tsx`
  - [ ] Collapsible reasoning section
  - [ ] Chain-of-thought formatting
- [ ] 8.7 Create chat input form with send button
- [ ] 8.8 Add cancel session button
- [ ] 8.9 Integrate streaming hook
- [ ] 8.10 Add step counter and progress indicator

### Test Criteria

```bash
netlify dev
# Navigate to /agent-chat
```

**Pass Criteria:**
- [ ] Can select an agent
- [ ] Can start new session
- [ ] Can send messages
- [ ] Messages stream in real-time
- [ ] Tool executions display correctly
- [ ] Reasoning is visible (collapsible)
- [ ] Can cancel running session
- [ ] Session list updates correctly
- [ ] Responsive design works

### Notes

_Document any issues or decisions made during this phase:_

---

## Phase 9: Memory Management UI

**Status:** ⬜ NOT STARTED

**Goal:** Create UI for viewing and managing agent long-term memories.

### Tasks

- [ ] 9.1 Create `src/pages/agent-chat/MemoryManagementPage.tsx`
- [ ] 9.2 Create `src/pages/agent-chat/components/MemoryList.tsx`
  - [ ] Filter by agent
  - [ ] Filter by memory type
  - [ ] Search functionality
- [ ] 9.3 Create `src/pages/agent-chat/components/MemoryCard.tsx`
  - [ ] Display memory content
  - [ ] Show metadata (importance, access count)
  - [ ] Edit/delete actions
- [ ] 9.4 Create `src/pages/agent-chat/components/MemoryForm.tsx`
  - [ ] Add manual memory
  - [ ] Memory type selector
  - [ ] Importance slider
- [ ] 9.5 Create memory suggestion UI (post-session)
  - [ ] Display suggested memories
  - [ ] Approve/reject buttons
  - [ ] Edit before saving

### Test Criteria

```bash
netlify dev
# Navigate to /agent-chat/memories
```

**Pass Criteria:**
- [ ] Memory list displays correctly
- [ ] Filters work
- [ ] Can add manual memories
- [ ] Can edit/delete memories
- [ ] Post-session suggestions work
- [ ] Approve/reject flow works

### Notes

_Document any issues or decisions made during this phase:_

---

## Phase 10: Integration & Polish

**Status:** ⬜ NOT STARTED

**Goal:** Final integration, error handling, and polish.

### Tasks

- [ ] 10.1 Add loading states to all components
- [ ] 10.2 Add error boundaries
- [ ] 10.3 Add toast notifications for success/error
- [ ] 10.4 Add rate limiting (max concurrent sessions per user)
- [ ] 10.5 Add comprehensive error handling
- [ ] 10.6 Write integration tests
- [ ] 10.7 Write unit tests for critical paths
- [ ] 10.8 Test all user flows end-to-end
- [ ] 10.9 Performance optimization
- [ ] 10.10 Accessibility audit
- [ ] 10.11 Update documentation

### Test Criteria

```bash
# Run all tests
npm test

# Run e2e tests (if applicable)
npm run test:e2e
```

**Pass Criteria:**
- [ ] All tests passing
- [ ] No console errors in browser
- [ ] Loading states display correctly
- [ ] Error messages are user-friendly
- [ ] Rate limiting works
- [ ] Accessibility audit passes
- [ ] Documentation updated

### Notes

_Document any issues or decisions made during this phase:_

---

## Completion Checklist

Before marking the feature as complete:

- [ ] All 10 phases marked as ✅ COMPLETED
- [ ] All migrations applied to production
- [ ] `/db_ref.md` fully updated
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Feature tested in production environment
- [ ] Documentation updated
- [ ] Move `buildAgentMode.md` to `plans/completedPlans/`
- [ ] Move this file to `plans/completedPlans/`

---

## Blockers & Issues Log

_Document any blockers encountered during execution:_

| Date       | Phase | Issue | Resolution | Status |
|------------|-------|-------|------------|--------|
| -          | -     | -     | -          | -      |

---

## Decision Log

_Document any decisions made during execution that deviate from the original plan:_

| Date       | Phase | Decision | Rationale |
|------------|-------|----------|-----------|
| -          | -     | -        | -         |

---

*Last Updated: [Update this date when making changes]*
