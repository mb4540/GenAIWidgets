# AI Gateway Chat Improvements Plan

## Overview

Enhance the AI Gateway Chat page with provider toggle controls and convert to background API architecture to resolve timeout issues with slower models (GPT-5*).

## Requirements

1. **Provider Toggles**: Add ability to enable/disable each AI provider (OpenAI, Anthropic, Google)
2. **Background API**: Convert AI chat calls to background functions to handle longer-running models
3. **GPT-5 Fix**: Resolve timeout issues with GPT-5* models by leveraging background function's extended timeout

## Current Architecture

- **Frontend**: `src/pages/ai/AiGatewayChatPage.tsx` - Makes single POST to `/api/ai/chat`
- **Backend**: `netlify/functions/ai-chat.ts` - Synchronous function calling all 3 providers in parallel
- **Issue**: Standard Netlify functions timeout at 10 seconds; GPT-5 models can take longer

## Proposed Architecture

### 1. Frontend Changes (`src/pages/ai/AiGatewayChatPage.tsx`)

Add state for provider toggles:
```typescript
const [enabledProviders, setEnabledProviders] = useState<Record<Provider, boolean>>({
  openai: true,
  anthropic: true,
  gemini: true,
});
```

Update UI to show toggle switches next to each provider card:
- Toggle switch component (checkbox or switch UI)
- Disabled provider cards are grayed out and excluded from API calls
- Only send enabled providers in request body

Update request flow:
1. POST to `/api/ai/chat-trigger` with message and enabled providers
2. Receive `jobId` in response
3. Poll `/api/ai/chat-status?jobId={id}` until all results are ready
4. Display results as they become available (partial updates)

### 2. Backend Changes

#### New Function: `netlify/functions/ai-chat-trigger.ts`
- Accepts POST with `{ message, models, enabledProviders }`
- Generates unique `jobId`
- Stores job metadata in Netlify Blobs (store: `ai-chat-jobs`)
- Triggers background worker
- Returns `{ jobId }` immediately

#### New Function: `netlify/functions/ai-chat-background.ts`
- Background function with extended timeout (configured in `netlify.toml`)
- Processes each enabled provider sequentially or in parallel
- Updates job status in Netlify Blobs as each provider completes
- Uses Netlify AI Gateway for all provider calls (existing pattern)

#### New Function: `netlify/functions/ai-chat-status.ts`
- GET endpoint: `/api/ai/chat-status?jobId={id}`
- Reads job status from Netlify Blobs
- Returns current status and any completed results
- Allows frontend to poll for updates

#### Update `netlify.toml`
Add redirect rules and background function config:
```toml
[functions."ai-chat-background"]
  timeout = 60

[[redirects]]
  from = "/api/ai/chat-trigger"
  to = "/.netlify/functions/ai-chat-trigger"
  status = 200

[[redirects]]
  from = "/api/ai/chat-status"
  to = "/.netlify/functions/ai-chat-status"
  status = 200
```

### 3. Data Storage (Netlify Blobs)

Job record structure in `ai-chat-jobs` store:
```typescript
interface AiChatJob {
  jobId: string;
  message: string;
  enabledProviders: string[];
  models: Record<string, string>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results: {
    openai?: ProviderResult;
    anthropic?: ProviderResult;
    gemini?: ProviderResult;
  };
  createdAt: string;
  completedAt?: string;
}
```

## Implementation Steps

### Phase 1: Frontend Toggle UI
1. Add `enabledProviders` state to `AiGatewayChatPage.tsx`
2. Add toggle switch UI component to each provider card
3. Update request to only include enabled providers
4. Gray out disabled provider cards in results display

### Phase 2: Backend Background Architecture
1. Create `ai-chat-trigger.ts` - job creation endpoint
2. Create `ai-chat-background.ts` - worker with 60s timeout
3. Create `ai-chat-status.ts` - polling endpoint
4. Update `netlify.toml` with new routes and timeout config
5. Keep using Netlify AI Gateway (OpenAI/Anthropic SDKs + Gemini fetch)

### Phase 3: Frontend Polling
1. Update `handleSubmit` to use trigger + polling pattern
2. Show loading state per-provider (not global)
3. Display results as each provider completes
4. Handle timeout/error states gracefully

### Phase 4: Cleanup
1. Remove or deprecate old `ai-chat.ts` (or keep as fallback)
2. Update any tests
3. Test with GPT-5* models to verify timeout fix

## Files to Create/Modify

### Create
- `netlify/functions/ai-chat-trigger.ts`
- `netlify/functions/ai-chat-background.ts`
- `netlify/functions/ai-chat-status.ts`

### Modify
- `src/pages/ai/AiGatewayChatPage.tsx` - Add toggles and polling
- `netlify.toml` - Add new routes and timeout config

### Potentially Remove
- `netlify/functions/ai-chat.ts` (after migration complete)

## Testing Checklist

- [ ] Toggle each provider on/off individually
- [ ] Toggle all providers off (should show warning)
- [ ] Send message with only 1 provider enabled
- [ ] Send message with all providers enabled
- [ ] Test GPT-5, GPT-5 Mini, GPT-5 Nano models
- [ ] Test O3 Mini, O4 Mini models
- [ ] Verify Netlify AI Gateway is used for all calls
- [ ] Test timeout handling (provider takes too long)
- [ ] Test error handling (provider returns error)
