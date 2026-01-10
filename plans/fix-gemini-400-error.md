# Fix Gemini 400 Error Plan

## Issue

Gemini returns HTTP 400 error when called through Netlify AI Gateway, while OpenAI and Anthropic work correctly.

## Current State

- OpenAI: Working
- Anthropic: Working  
- Gemini: Error 400 (Bad Request)

## Investigation Notes

- Using REST API with `GOOGLE_GEMINI_BASE_URL` and `x-goog-api-key` header
- Model: `gemini-2.5-pro`
- Request format matches Netlify docs

## Possible Causes

1. **Model name incorrect** - May need different model identifier (e.g., `gemini-1.5-flash`, `gemini-pro`)
2. **Request body format** - May need different structure for the contents array
3. **API version mismatch** - Using `/v1beta/` but may need different version
4. **Rate limiting or quota** - Gemini may have different limits through AI Gateway

## Tasks

- [ ] Check Netlify function logs for detailed error response
- [ ] Try different model names (`gemini-1.5-flash`, `gemini-pro`, `gemini-1.5-pro`)
- [ ] Verify request body format matches Google's current API spec
- [ ] Check if `GOOGLE_GEMINI_BASE_URL` is being set correctly in the function
- [ ] Review Netlify AI Gateway changelog for Gemini-specific requirements

## Current Code

```typescript
const response = await fetch(
  `${baseUrl}/v1beta/models/gemini-2.5-pro:generateContent`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: message }] }],
    }),
  }
);
```

## Priority

Medium - Feature works with 2/3 providers. Can be addressed after other items.

## Related Files

- `netlify/functions/ai-chat.ts` - The function making the Gemini call
- `.windsurf/rules/ai-gateway.md` - AI Gateway documentation
