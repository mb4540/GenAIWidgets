# Fix AI Gateway Implementation Plan

## Problem Summary

All three providers (OpenAI, Anthropic, Gemini) are returning 400 errors. The implementation has several issues:

1. **Invalid model names** - Using models not supported by AI Gateway (e.g., `gpt-4-turbo`, `claude-3.5-sonnet`)
2. **Not using official SDKs** - Docs recommend using official client libraries which auto-configure
3. **Static model list is incorrect** - Need to use the exact model IDs from AI Gateway docs

## Root Cause Analysis

From `AIGatewayDoc.md`, the AI Gateway:
- Auto-injects `OPENAI_API_KEY`, `OPENAI_BASE_URL`
- Auto-injects `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`
- Auto-injects `GEMINI_API_KEY`, `GOOGLE_GEMINI_BASE_URL`
- Official SDKs pick these up automatically with zero config

## Supported Models (from AIGatewayDoc.md)

### OpenAI
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4.1`
- `gpt-4.1-mini`
- `gpt-4.1-nano`
- `gpt-5`
- `gpt-5-mini`
- `gpt-5-nano`
- `gpt-5-pro`
- `o3`
- `o3-mini`
- `o4-mini`
- `codex-mini-latest`

### Anthropic
- `claude-3-haiku-20240307`
- `claude-3-5-haiku-20241022`
- `claude-3-7-sonnet-20250219`
- `claude-sonnet-4-0`
- `claude-sonnet-4-20250514`
- `claude-sonnet-4-5`
- `claude-sonnet-4-5-20250929`
- `claude-haiku-4-5`
- `claude-haiku-4-5-20251001`
- `claude-opus-4-20250514`
- `claude-opus-4-5`

### Gemini
- `gemini-2.0-flash`
- `gemini-2.0-flash-lite`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`
- `gemini-2.5-pro`
- `gemini-3-flash-preview`
- `gemini-3-pro-preview`
- `gemini-flash-latest`
- `gemini-flash-lite-latest`

## Implementation Plan

### Phase 1: Install Official SDKs
- [ ] Install `openai` package
- [ ] Install `@anthropic-ai/sdk` package
- [ ] Keep `@google/generative-ai` or use REST for Gemini

### Phase 2: Rewrite Netlify Function
- [ ] Use OpenAI SDK with zero config (auto-picks up env vars)
- [ ] Use Anthropic SDK with zero config
- [ ] Use REST API for Gemini with `GOOGLE_GEMINI_BASE_URL` and `x-goog-api-key` header

### Phase 3: Update Frontend Model Lists
- [ ] Update OpenAI models to match AI Gateway supported list
- [ ] Update Anthropic models to match AI Gateway supported list
- [ ] Update Gemini models to match AI Gateway supported list
- [ ] Set sensible defaults that are known to work

### Phase 4: Test and Deploy
- [ ] Deploy to Netlify (must have production deploy for AI Gateway to work)
- [ ] Test each provider individually
- [ ] Verify model selection works

## Code Changes Required

### 1. Install packages
```bash
npm install openai @anthropic-ai/sdk
```

### 2. Update `netlify/functions/ai-chat.ts`

Use official SDKs:

```typescript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// OpenAI - SDK auto-configures from env vars
const openai = new OpenAI();
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: message }],
});

// Anthropic - SDK auto-configures from env vars
const anthropic = new Anthropic();
const response = await anthropic.messages.create({
  model: 'claude-3-haiku-20240307',
  max_tokens: 1024,
  messages: [{ role: 'user', content: message }],
});

// Gemini - Use REST with base URL
const response = await fetch(
  `${process.env.GOOGLE_GEMINI_BASE_URL}/v1beta/models/${model}:generateContent`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: message }] }],
    }),
  }
);
```

### 3. Update `src/pages/ai/AiGatewayChatPage.tsx`

Update model lists to only include AI Gateway supported models.

## Notes

- AI Gateway requires at least one production deploy to activate
- The model list is static from Netlify docs - no API to fetch dynamically
- SDKs auto-configure when running in Netlify compute context
