# First Feature Plan: App Shell + Netlify AI Gateway Multi-Model Chat

## Goal

Deliver two outcomes:

1. A reusable **application shell** with a **left-hand navigation panel**.
2. A first feature accessible from that nav: **AI Gateway Chat**
   - Chat window in the main body
   - Model/provider selector for:
     - OpenAI
     - Anthropic
     - Gemini
   - When the user asks a question, the app requests responses from **all three providers** and displays them.

---

## Assumptions / Constraints

- Local dev should be run with `netlify dev` (not `npm run dev`).
- Do not expose secrets in the browser. All AI calls happen in a Netlify Function.
- Use Netlify AI Gateway environment variables in compute contexts.
- TypeScript strict mode.

---

## Phase A: App Shell + Routing

### A1. Layout

- Create an `AppLayout` with:
  - Fixed left navigation
  - Main content area
- The layout should be used by routes that represent “app pages” (e.g. dashboard + features).

### A2. Navigation

- Add left nav entries:
  - Dashboard (existing)
  - AI Gateway Chat (new)

### A3. Routing changes

- Update routing to:
  - Wrap protected app routes in the layout
  - Add a route for the chat feature, e.g. `/ai-gateway-chat`

Acceptance criteria:
- Navigating between dashboard and chat works.
- Layout remains stable while only main content changes.

---

## Phase B: Backend API (Netlify Function)

### B1. Create a single endpoint

- Create a new function (flat file naming): `netlify/functions/ai-chat.ts`
- Add a redirect in `netlify.toml`:
  - `/api/ai/chat` → `/.netlify/functions/ai-chat`

### B2. Request/response contract

Request:

```ts
interface AiChatRequest {
  message: string
  providers: {
    openai: boolean
    anthropic: boolean
    gemini: boolean
  }
}
```

Response:

```ts
interface ProviderResult {
  ok: boolean
  text?: string
  error?: string
}

interface AiChatResponse {
  success: true
  results: {
    openai: ProviderResult
    anthropic: ProviderResult
    gemini: ProviderResult
  }
}
```

### B3. Fan-out to providers via Netlify AI Gateway

Implementation approach:
- In the function, run the three provider requests concurrently.
- Each provider call:
  - Uses the provider-specific base URL / key auto-injected by Netlify AI Gateway **OR** the Netlify Gateway base URL + key if that’s the required pattern (implementation will follow `.windsurf/rules/ai-gateway.md`).
- Never log keys/tokens.

Acceptance criteria:
- Function returns a response even if one provider fails (partial success).
- Error messages returned are safe and generic.

---

## Phase C: Frontend AI Gateway Chat Page

### C1. Page/UI

Create `src/pages/ai/AiGatewayChatPage.tsx` (or similar) with:
- A provider selection UI:
  - Dropdown that selects:
    - “Ask all (OpenAI + Anthropic + Gemini)” (default)
    - “OpenAI only”
    - “Anthropic only”
    - “Gemini only”
- Chat input
- Chat history area

### C2. Behavior

- On submit:
  - Append user message to history
  - Call `/api/ai/chat`
  - Display results grouped by provider (3 panels or cards)
  - Preserve prior turns in the UI (client-only history is fine for v1)

Acceptance criteria:
- Asking a question shows three answers (or errors per provider) with clear labeling.
- UI shows loading state while awaiting responses.

---

## Phase D: Verification

### D1. Local

- Run:
  - `netlify dev`
- Validate:
  - `/ai-gateway-chat` loads
  - Calling `/api/ai/chat` works locally (may require Netlify dev context)

### D2. Production

- Ensure deploy succeeds
- Verify AI Gateway is enabled and env vars are present in function runtime

---

## Open Questions

- Exact AI Gateway request format for each provider (OpenAI/Anthropic/Gemini) using Netlify’s injected base URLs and keys. We will implement according to `.windsurf/rules/ai-gateway.md` and Netlify’s current docs during build.
- UI presentation preference:
  - 3 side-by-side answer cards vs. stacked sections.
