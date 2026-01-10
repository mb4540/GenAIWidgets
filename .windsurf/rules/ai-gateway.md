# AI Gateway Rules

Guidelines for using Netlify's AI Gateway to integrate AI models into your project.

---

## Overview

Netlify AI Gateway provides access to popular AI models (OpenAI, Anthropic, Google Gemini) without managing separate provider accounts or API keys. Netlify handles authentication and billing based on token usage.

---

## Prerequisites

- Project must have at least one **production deployment** to activate AI Gateway
- Credit-based Netlify plan (Free, Personal, or Pro)
- AI features only work in Netlify compute contexts (Functions, Edge Functions)

---

## Environment Variables

### Auto-Injected Variables

In Netlify compute contexts, these are automatically set:

| Provider | API Key Variable | Base URL Variable |
|----------|------------------|-------------------|
| OpenAI | `OPENAI_API_KEY` | `OPENAI_BASE_URL` |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` |
| Google | `GEMINI_API_KEY` | `GOOGLE_GEMINI_BASE_URL` |

**Netlify-specific** (always available):
- `NETLIFY_AI_GATEWAY_KEY`
- `NETLIFY_AI_GATEWAY_BASE_URL`

### Override Behavior

- If you set your own API keys at project/team level, Netlify will **not** override them
- Use your own keys for higher rate limits or specific provider features
- Auto-injected keys use Netlify's credit-based billing

---

## Using Official Client Libraries

### OpenAI

```typescript
import OpenAI from 'openai';

// No configuration needed - picks up env vars automatically
const openai = new OpenAI();

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### Anthropic

```typescript
import Anthropic from '@anthropic-ai/sdk';

// No configuration needed
const anthropic = new Anthropic();

const response = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### Google GenAI

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

// Must pass API key explicitly
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

const result = await model.generateContent('Hello');
```

---

## Using Third-Party Libraries or REST

When using libraries that don't auto-detect environment variables:

```typescript
// Manually pass credentials
const client = new SomeAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});
```

### Direct REST Calls

```typescript
const response = await fetch(`${process.env.OPENAI_BASE_URL}/chat/completions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }],
  }),
});
```

---

## Local Development

### Using Netlify CLI

```bash
# Start dev server with AI Gateway access
netlify dev
```

### Using Vite Plugin

Install `@netlify/vite-plugin` for local AI Gateway functionality.

### Without Netlify Tools

For local development without Netlify CLI:
- Set your own provider API keys in `.env`
- Or mock AI responses for testing

---

## Rate Limiting

### Netlify Limits

- **Tokens-per-minute (TPM)** limits per account
- Both input and output tokens count
- Limits vary by plan and model
- Check Netlify documentation for current limits

### Implementing Client Rate Limiting

```typescript
import { Handler } from '@netlify/functions';

// Simple in-memory rate limiting (use Redis for production)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = 10; // requests per minute
const WINDOW_MS = 60000;

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(clientId);
  
  if (!record || now > record.resetAt) {
    requestCounts.set(clientId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

export const handler: Handler = async (event) => {
  const clientId = event.headers['x-forwarded-for'] || 'unknown';
  
  if (!checkRateLimit(clientId)) {
    return {
      statusCode: 429,
      headers: { 'Retry-After': '60' },
      body: JSON.stringify({ error: 'Rate limit exceeded' }),
    };
  }
  
  // Process AI request...
};
```

---

## Cost Management

### Monitoring Usage

- Monitor token usage in Netlify dashboard
- Set up billing alerts
- Track per-endpoint usage in application logs

### Reducing Costs

- Use appropriate model sizes (don't use GPT-4 for simple tasks)
- Implement caching for repeated queries
- Limit max tokens in responses
- Use streaming for long responses (better UX, same cost)

---

## Limitations

### Current Constraints

| Limitation | Details |
|------------|---------|
| Production deploy required | AI Gateway activates after first production deploy |
| Context window | Limited to 200k tokens |
| Caching | Provider-specific limitations apply |
| Headers | Custom headers not passed through |
| Batch inference | Not supported |
| Priority processing | Not supported |

### Handling Limitations

- Deploy to production before testing AI features
- Split large documents to fit context window
- Implement application-level caching
- Use standard request/response patterns

---

## Security & Privacy

### Data Handling

- Netlify AI Gateway **does not store** prompts or model outputs
- Data passes through to providers
- Follow provider-specific privacy policies

### Security Rules

- Never send sensitive PII in prompts
- Never log prompts or responses containing user data
- Follow `security.md` logging restrictions
- Sanitize user input before including in prompts

### Prompt Injection Prevention

```typescript
// Sanitize user input
function sanitizeForPrompt(userInput: string): string {
  // Remove potential injection patterns
  return userInput
    .replace(/```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, 1000); // Limit length
}

const prompt = `Summarize this text: "${sanitizeForPrompt(userInput)}"`;
```

---

## Preferred Practices

### Do

- Use official client libraries for AI calls
- Rely on automatically injected environment variables
- Implement rate limiting on your endpoints
- Deploy to production before using AI features
- Handle API errors gracefully
- Set reasonable max_tokens limits
- Use streaming for better UX on long responses

### Don't

- Hardcode API keys or base URLs
- Pass custom headers for experimental provider features
- Implement batch inference or priority processing
- Store or log AI prompts or outputs
- Send sensitive data in prompts
- Assume unlimited rate limits
- Skip error handling for AI calls

---

## Error Handling

```typescript
try {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0].message.content;
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      // Rate limited - implement backoff
      console.error('Rate limited by AI provider');
      return { error: 'Service busy, please try again' };
    }
    if (error.status === 400) {
      // Bad request - likely prompt issue
      console.error('Invalid AI request:', error.message);
      return { error: 'Invalid request' };
    }
  }
  console.error('AI call failed:', error);
  return { error: 'AI service unavailable' };
}
```

---

## Checklist

Before using AI Gateway:

- [ ] Production deployment completed
- [ ] Rate limiting implemented
- [ ] Error handling in place
- [ ] No hardcoded API keys
- [ ] Sensitive data not sent in prompts
- [ ] Prompts not logged
- [ ] Cost monitoring set up
- [ ] Appropriate model selected for task

---

*AI capabilities are powerful. Use them responsibly and efficiently.*
