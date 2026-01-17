# AI Gateway Chat Background Function Plan

## Overview
Convert the AI Gateway Chat from a synchronous function to a background function to resolve timeout issues when calling multiple AI providers (OpenAI, Anthropic, Google) in parallel.

## Problem Statement

### Current Issue
The screenshots show **504 Gateway Timeout** errors on `/api/ai/chat`:
```
Failed to load resource: the server responded with a status of 504
```

### Root Cause
- Current `ai-chat.ts` is a **synchronous Netlify Function** with a **10-second timeout**
- Calling 3 AI providers (OpenAI, Anthropic, Google) in parallel can exceed this limit
- Each provider may take 3-8 seconds to respond, especially for complex queries

### Solution
Convert to a **background function** with:
- 15-minute execution limit
- Asynchronous invocation pattern (client polls for results)
- Results stored temporarily for retrieval

---

## Feasibility Confirmation

✅ **Netlify AI Gateway works in background functions** because:
1. Background functions are Netlify compute contexts
2. Environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) are auto-injected
3. Existing `extraction-worker-background.ts` already calls Gemini successfully

---

## Architecture

### Current Flow (Synchronous)
```
Client → POST /api/ai/chat → Wait for all 3 providers → Response
         ↓
         [10 second timeout - FAILS]
```

### New Flow (Background + Polling)
```
Client → POST /api/ai/chat → Returns 202 + chatId immediately
         ↓
         Background function calls all 3 providers
         ↓
         Stores results in temporary storage
         ↓
Client → GET /api/ai/chat/status?id=chatId → Poll for results
         ↓
         Returns results when ready (or partial results)
```

---

## Implementation Plan

### Phase 1: Database Schema for Chat Results

#### 1.1 Create Migration
- [ ] Create `migrations/008_chat_results_table.sql`

```sql
-- Temporary storage for AI chat results
CREATE TABLE chat_results (
  chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Request
  message TEXT NOT NULL,
  models JSONB NOT NULL,  -- { openai: 'gpt-4o', anthropic: 'claude-3', gemini: 'gemini-2.5' }
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
  
  -- Results (populated as each provider responds)
  results JSONB DEFAULT '{}',  -- { openai: { ok: true, text: '...' }, ... }
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Auto-cleanup: results expire after 1 hour
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
);

-- Index for polling
CREATE INDEX idx_chat_results_user ON chat_results(user_id, created_at DESC);
CREATE INDEX idx_chat_results_expires ON chat_results(expires_at);
```

#### 1.2 Cleanup Job (Optional)
- [ ] Add scheduled function to delete expired results
- [ ] Or rely on PostgreSQL's `pg_cron` if available

### Phase 2: Background Function

#### 2.1 Create `ai-chat-background.ts`
- [ ] Create new file: `netlify/functions/ai-chat-background.ts`
- [ ] Implement background processing logic:
  - Receive `chatId` from trigger
  - Fetch chat request from database
  - Call all 3 providers in parallel
  - Update results incrementally as each provider responds
  - Mark as completed when all done

```typescript
// netlify/functions/ai-chat-background.ts
import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req: Request, _context: Context) {
  const { chatId } = await req.json();
  const sql = neon(process.env.DATABASE_URL!);
  
  // Fetch chat request
  const [chat] = await sql`
    SELECT * FROM chat_results WHERE chat_id = ${chatId}
  `;
  
  if (!chat) return new Response('Not found', { status: 404 });
  
  // Update status to processing
  await sql`UPDATE chat_results SET status = 'processing' WHERE chat_id = ${chatId}`;
  
  const models = chat.models;
  const message = chat.message;
  const results: Record<string, unknown> = {};
  
  // Call providers in parallel, update results as each completes
  const promises = [];
  
  if (models.openai) {
    promises.push(
      queryOpenAI(message, models.openai)
        .then(async (result) => {
          results.openai = result;
          await sql`UPDATE chat_results SET results = results || ${JSON.stringify({ openai: result })}::jsonb WHERE chat_id = ${chatId}`;
        })
    );
  }
  
  // ... similar for anthropic and gemini
  
  await Promise.all(promises);
  
  // Mark completed
  await sql`UPDATE chat_results SET status = 'completed', completed_at = NOW() WHERE chat_id = ${chatId}`;
  
  return new Response('OK');
}
```

### Phase 3: Trigger Function

#### 3.1 Modify `ai-chat.ts` to Trigger Background
- [ ] Change from direct processing to:
  1. Create `chat_results` record
  2. Trigger background function
  3. Return `chatId` immediately

```typescript
// Modified ai-chat.ts
export default async function handler(req: Request, _context: Context) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  const { message, models } = await req.json();
  const sql = neon(process.env.DATABASE_URL!);
  
  // Create chat record
  const [chat] = await sql`
    INSERT INTO chat_results (message, models, status)
    VALUES (${message}, ${JSON.stringify(models)}, 'pending')
    RETURNING chat_id
  `;
  
  // Trigger background function
  await fetch(`${process.env.URL}/.netlify/functions/ai-chat-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: chat.chat_id }),
  });
  
  return new Response(JSON.stringify({
    success: true,
    chatId: chat.chat_id,
    status: 'pending',
  }), { status: 202 });
}
```

### Phase 4: Status Endpoint

#### 4.1 Create `ai-chat-status.ts`
- [ ] Create new file: `netlify/functions/ai-chat-status.ts`
- [ ] Implement polling endpoint:

```typescript
// netlify/functions/ai-chat-status.ts
export default async function handler(req: Request, _context: Context) {
  const url = new URL(req.url);
  const chatId = url.searchParams.get('id');
  
  if (!chatId) {
    return new Response(JSON.stringify({ error: 'Chat ID required' }), { status: 400 });
  }
  
  const sql = neon(process.env.DATABASE_URL!);
  const [chat] = await sql`
    SELECT status, results, created_at, completed_at
    FROM chat_results
    WHERE chat_id = ${chatId}
  `;
  
  if (!chat) {
    return new Response(JSON.stringify({ error: 'Chat not found' }), { status: 404 });
  }
  
  return new Response(JSON.stringify({
    success: true,
    status: chat.status,
    results: chat.results,
    createdAt: chat.created_at,
    completedAt: chat.completed_at,
  }));
}
```

### Phase 5: Frontend Updates

#### 5.1 Update `AiGatewayChatPage.tsx`
- [ ] Modify `handleSubmit` to:
  1. POST to `/api/ai/chat` → get `chatId`
  2. Start polling `/api/ai/chat/status?id=chatId`
  3. Update UI as results arrive (partial results supported)
  4. Stop polling when status is `completed`

```typescript
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  if (!input.trim() || loading) return;
  
  setLoading(true);
  
  // 1. Trigger background processing
  const triggerResponse = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: input, models: selectedModels }),
  });
  
  const { chatId } = await triggerResponse.json();
  
  // 2. Poll for results
  const pollInterval = setInterval(async () => {
    const statusResponse = await fetch(`/api/ai/chat/status?id=${chatId}`);
    const { status, results } = await statusResponse.json();
    
    // Update UI with partial results
    setCurrentResults(results);
    
    if (status === 'completed' || status === 'failed') {
      clearInterval(pollInterval);
      setLoading(false);
      // Add final message to chat
    }
  }, 1000); // Poll every second
};
```

#### 5.2 UI Enhancements
- [ ] Show partial results as they arrive (provider cards appear one by one)
- [ ] Show progress indicator per provider (pending/loading/done)
- [ ] Handle timeout gracefully (stop polling after 2 minutes)

---

## Files to Create/Modify

### New Files
- `migrations/008_chat_results_table.sql`
- `netlify/functions/ai-chat-background.ts`
- `netlify/functions/ai-chat-status.ts`

### Modified Files
- `netlify/functions/ai-chat.ts` - Convert to trigger function
- `src/pages/ai/AiGatewayChatPage.tsx` - Add polling logic
- `src/pages/ai/AiGatewayChatPage.test.tsx` - Update tests

---

## Alternative Approaches Considered

### 1. Server-Sent Events (SSE)
- **Pros**: Real-time updates, no polling
- **Cons**: More complex, Netlify Functions don't support long-lived connections well

### 2. WebSockets
- **Pros**: Bi-directional, real-time
- **Cons**: Requires separate infrastructure, overkill for this use case

### 3. Increase Timeout (Not Possible)
- Netlify synchronous functions have a hard 10-second limit
- Cannot be increased

### 4. Call Providers Sequentially
- **Pros**: Simpler, might fit in 10 seconds
- **Cons**: Poor UX, still risky for slow providers

**Chosen Approach**: Background function + polling is the best balance of reliability, simplicity, and UX.

---

## Testing Considerations

- [ ] Test background function triggers correctly
- [ ] Test polling returns partial results
- [ ] Test completed status stops polling
- [ ] Test error handling (provider failures)
- [ ] Test cleanup of expired results
- [ ] Test concurrent requests from same user
- [ ] Load test with multiple simultaneous users

---

## Rollback Plan

If issues arise:
1. Keep original `ai-chat.ts` as `ai-chat-sync.ts`
2. Add feature flag to switch between sync/async modes
3. Can revert by changing frontend to use sync endpoint

---

## Open Questions

- Should we require authentication for chat? (Currently no auth)
- Should we limit concurrent chats per user?
- Should we persist chat history beyond 1 hour?
- Should we add retry logic for failed providers?
