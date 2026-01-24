# Next Features Implementation Plan

## Overview

This plan covers four major features from `nextFeatures.md`:
1. Rename "AI Gateway Chat" to "Compare AI Models" and create new "AI Chat" page
2. Admin Dashboard "Blob Storage" tab with CRUD operations
3. New "Web Search" Agent Tool

---

## Feature 1: AI Chat Restructuring

### 1.1 Rename "AI Gateway Chat" → "Compare AI Models"

**Files to Modify:**
- `src/components/layout/AppLayout.tsx` - Update nav label

**Changes:**
```typescript
// Change from:
{ to: '/ai-gateway-chat', label: 'AI Gateway Chat', icon: MessageSquare },
// To:
{ to: '/compare-ai-models', label: 'Compare AI Models', icon: GitCompare },
```

**Route Update in `src/App.tsx`:**
```typescript
// Change from:
<Route path="/ai-gateway-chat" element={<AiGatewayChatPage />} />
// To:
<Route path="/compare-ai-models" element={<AiGatewayChatPage />} />
```

**Estimated Effort:** 15 minutes

---

### 1.2 Create New "AI Chat" Page

**Purpose:** Single-model chat with history sidebar (similar to Agent Chat)

#### New Files to Create:

| File | Purpose |
|------|---------|
| `src/pages/ai-chat/AiChatPage.tsx` | Main chat page component |
| `src/pages/ai-chat/components/AiChatHistorySidebar.tsx` | Chat history sidebar |
| `src/pages/ai-chat/components/ModelSelector.tsx` | Provider/model selector |
| `netlify/functions/ai-chat-sessions.ts` | CRUD for AI chat sessions |
| `netlify/functions/ai-chat-messages.ts` | CRUD for AI chat messages |

#### Database Schema (per database-design.md rules):

**New Table: `ai_chat_sessions`**
```sql
CREATE TABLE ai_chat_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title TEXT,
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_sessions_tenant_id ON ai_chat_sessions(tenant_id);
```

**New Table: `ai_chat_messages`**
```sql
CREATE TABLE ai_chat_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(session_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_messages_session_id ON ai_chat_messages(session_id);
```

#### API Endpoints (per api-design.md rules):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai-chat-sessions` | List user's chat sessions |
| GET | `/api/ai-chat-sessions?id={id}` | Get session with messages |
| POST | `/api/ai-chat-sessions` | Create new session |
| DELETE | `/api/ai-chat-sessions?id={id}` | Delete session |
| POST | `/api/ai-chat` | Send message (existing, needs modification) |

#### Frontend Components (per frontend-components.md rules):

**AiChatPage Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Header: AI Chat                          [Model Selector]   │
├──────────────┬──────────────────────────────────────────────┤
│ Chat History │ Chat Area                                    │
│              │                                              │
│ [Session 1]  │ ┌──────────────────────────────────────────┐ │
│ [Session 2]  │ │ Messages                                 │ │
│ [Session 3]  │ │                                          │ │
│              │ │                                          │ │
│ + New Chat   │ │                                          │ │
│              │ ├──────────────────────────────────────────┤ │
│              │ │ Input                                    │ │
└──────────────┴──────────────────────────────────────────────┘
```

**Component Checklist (from frontend-components.md):**
- [ ] Props interface defined
- [ ] No `any` types
- [ ] Uses Tailwind utilities consistently
- [ ] Accessible (keyboard, screen reader)
- [ ] Handles loading state
- [ ] Handles error state
- [ ] Responsive design verified

**Estimated Effort:** 4-6 hours

---

## Feature 2: Admin Blob Storage Tab

### 2.1 Overview

Add a "Blob Storage" tab to the Admin Dashboard for CRUD operations on three Netlify Blob stores:
- `ai-chats-jobs` - AI chat job data
- `extracted-chunks` - RAG extraction chunks
- `user-files` - User uploaded files

### 2.2 New Files to Create

| File | Purpose |
|------|---------|
| `src/pages/admin/components/BlobStorageTab.tsx` | Main tab component |
| `src/pages/admin/components/BlobStoreList.tsx` | List blobs in a store |
| `src/pages/admin/components/BlobDetailModal.tsx` | View/edit blob content |
| `netlify/functions/admin-blobs.ts` | CRUD API for blob operations |

### 2.3 API Endpoints (per api-design.md rules):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/blobs?store={name}` | List blobs in store |
| GET | `/api/admin/blobs?store={name}&key={key}` | Get blob content |
| PUT | `/api/admin/blobs?store={name}&key={key}` | Update blob content |
| DELETE | `/api/admin/blobs?store={name}&key={key}` | Delete blob |

**Security (per security.md rules):**
- Admin-only access required
- Validate store name against whitelist
- Sanitize blob keys
- Log all operations

### 2.4 Backend Implementation

```typescript
// netlify/functions/admin-blobs.ts
import { getStore } from '@netlify/blobs';

const ALLOWED_STORES = ['ai-chats-jobs', 'extracted-chunks', 'user-files'];

// Validate store name
if (!ALLOWED_STORES.includes(storeName)) {
  return createErrorResponse(400, 'Invalid store name');
}
```

### 2.5 Frontend Implementation

**BlobStorageTab Component:**
```typescript
interface BlobStorageTabProps {
  className?: string;
}

// State
const [selectedStore, setSelectedStore] = useState<string>('user-files');
const [blobs, setBlobs] = useState<BlobEntry[]>([]);
const [selectedBlob, setSelectedBlob] = useState<BlobEntry | null>(null);
```

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Store: [Dropdown: user-files ▼]              [Refresh]      │
├─────────────────────────────────────────────────────────────┤
│ Key                    │ Size    │ Modified    │ Actions    │
├────────────────────────┼─────────┼─────────────┼────────────┤
│ file-abc-123           │ 1.2 KB  │ 2024-01-15  │ 👁 ✏️ 🗑    │
│ file-def-456           │ 3.4 KB  │ 2024-01-14  │ 👁 ✏️ 🗑    │
└─────────────────────────────────────────────────────────────┘
```

### 2.6 Update AdminPage.tsx

Add new tab type and component:
```typescript
type TabType = 'tenants' | 'users' | 'memberships' | 'prompts' | 'blobs';

// Add tab button
<button onClick={() => setActiveTab('blobs')}>
  <Database className="h-4 w-4" /> Blob Storage
</button>

// Add tab content
{activeTab === 'blobs' && <BlobStorageTab />}
```

**Estimated Effort:** 3-4 hours

---

## Feature 3: Web Search Agent Tool

### 3.1 Overview

Create a new agent tool that allows agents to search the web using a URL and query.

### 3.2 New Files to Create

| File | Purpose |
|------|---------|
| `netlify/functions/tool-web-search.ts` | Web search tool implementation |
| `scripts/seed-web-search-tool.sql` | SQL to add tool to database |

### 3.3 Database Entry (tools table)

```sql
INSERT INTO tools (
  name,
  description,
  tool_type,
  input_schema,
  is_active
) VALUES (
  'web_search',
  'Search the web for information. Provide a URL to search within or a general search query.',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "Optional URL to search within"
      },
      "query": {
        "type": "string",
        "description": "Search query"
      }
    },
    "required": ["query"]
  }',
  true
);
```

### 3.4 Backend Implementation

**Option A: Use Netlify AI Gateway with search-capable model**
```typescript
// Use a model that has web search capabilities
// e.g., Perplexity API or similar
```

**Option B: Use external search API**
```typescript
// Use SerpAPI, Brave Search API, or similar
// Requires API key configuration
```

**Option C: Use Netlify's built-in capabilities**
```typescript
// Check if Netlify AI Gateway supports web search
// May need to use specific model features
```

### 3.5 Tool Implementation Pattern

```typescript
// netlify/functions/tool-web-search.ts
import type { Context } from '@netlify/functions';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface WebSearchInput {
  url?: string;
  query: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export default async function handler(req: Request, context: Context) {
  // 1. Authenticate request
  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return createErrorResponse(401, 'Unauthorized');
  }

  // 2. Parse and validate input
  const input = await req.json() as WebSearchInput;
  if (!input.query) {
    return createErrorResponse(400, 'Query is required');
  }

  // 3. Perform search
  const results = await performWebSearch(input.url, input.query);

  // 4. Return results
  return createSuccessResponse({ results });
}
```

### 3.6 Update agent-chat.ts

Add web_search to BUILTIN_TOOL_ENDPOINTS:
```typescript
const BUILTIN_TOOL_ENDPOINTS: Record<string, string> = {
  get_weather: '/api/tools/weather',
  list_files: '/api/tools/files',
  read_file: '/api/tools/files',
  create_file: '/api/tools/files',
  delete_file: '/api/tools/files',
  update_plan: '/api/tools/plan',
  web_search: '/api/tools/web-search',  // Add this
};
```

### 3.7 Environment Variables

May need to add:
- `SEARCH_API_KEY` - API key for search service (if using external API)

**Estimated Effort:** 2-3 hours

---

## Implementation Order

### Phase 1: Quick Wins (30 minutes)
1. Rename "AI Gateway Chat" → "Compare AI Models"
2. Update route from `/ai-gateway-chat` to `/compare-ai-models`

### Phase 2: AI Chat Page (4-6 hours)
1. Create database migration for `ai_chat_sessions` and `ai_chat_messages`
2. Update `db_ref.md` with new tables
3. Create `ai-chat-sessions.ts` API endpoint
4. Create `AiChatHistorySidebar.tsx` component
5. Create `AiChatPage.tsx` with model selector
6. Add route and nav item
7. Test end-to-end

### Phase 3: Admin Blob Storage (3-4 hours)
1. Create `admin-blobs.ts` API endpoint
2. Create `BlobStorageTab.tsx` component
3. Create `BlobStoreList.tsx` component
4. Create `BlobDetailModal.tsx` component
5. Update `AdminPage.tsx` with new tab
6. Test CRUD operations

### Phase 4: Web Search Tool (2-3 hours)
1. Research best search API option
2. Create `tool-web-search.ts` endpoint
3. Create SQL seed script
4. Update `agent-chat.ts` with new tool endpoint
5. Run seed script
6. Test with agent

---

## Testing Checklist (per testing.md rules)

### AI Chat Page
- [ ] Session creation works
- [ ] Session list loads correctly
- [ ] Messages send and receive
- [ ] Model switching works
- [ ] History sidebar updates
- [ ] Session deletion works

### Admin Blob Storage
- [ ] Store selection works
- [ ] Blob list loads
- [ ] Blob content viewable
- [ ] Blob content editable
- [ ] Blob deletion works
- [ ] Admin-only access enforced

### Web Search Tool
- [ ] Tool appears in agent tools list
- [ ] Search with query only works
- [ ] Search with URL + query works
- [ ] Results returned to agent
- [ ] Error handling works

---

## Quality Checklist (per .windsurf rules)

### Code Quality (code-quality.md)
- [ ] TypeScript strict mode compliance
- [ ] No `any` types
- [ ] Explicit return types for exported functions
- [ ] ESLint passes without warnings
- [ ] Consistent naming conventions

### Security (security.md)
- [ ] All secrets in environment variables
- [ ] Input validation on all endpoints
- [ ] Admin-only access for blob operations
- [ ] No sensitive data in logs

### API Design (api-design.md)
- [ ] RESTful conventions followed
- [ ] Consistent response structure
- [ ] Appropriate HTTP status codes
- [ ] Security headers included

### Database Design (database-design.md)
- [ ] `/db_ref.md` consulted and updated
- [ ] Foreign keys defined
- [ ] Indexes created for query patterns
- [ ] Migration files created

### Frontend Components (frontend-components.md)
- [ ] Props interfaces defined
- [ ] Tailwind classes organized
- [ ] Accessible (keyboard, screen reader)
- [ ] Loading/error states handled

---

## Estimated Total Effort

| Feature | Estimated Time |
|---------|----------------|
| Rename AI Gateway Chat | 30 minutes |
| AI Chat Page | 4-6 hours |
| Admin Blob Storage | 3-4 hours |
| Web Search Tool | 2-3 hours |
| **Total** | **10-14 hours** |

---

## Dependencies & Prerequisites

1. **Search API Decision** - Need to decide which search API to use for web search tool
2. **Netlify AI Gateway** - Verify current capabilities for single-model chat
3. **Admin Access** - Ensure admin authentication is working for blob operations

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Search API costs | Use free tier or rate limit |
| Blob storage size limits | Implement pagination |
| AI Gateway rate limits | Implement backoff |
| Database migration issues | Test on Neon branch first |

---

*Plan created following .windsurf rules for quality, security, and consistency.*
