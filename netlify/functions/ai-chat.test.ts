import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from './ai-chat';

function createMockRequest(method: string, body?: unknown): Request {
  return {
    method,
    json: () => Promise.resolve(body),
  } as Request;
}

const mockContext = {} as Parameters<typeof handler>[1];

describe('ai-chat handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GOOGLE_GEMINI_BASE_URL = 'https://test-gemini-url.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GEMINI_BASE_URL;
  });

  describe('HTTP methods', () => {
    it('should handle OPTIONS request for CORS', async () => {
      const req = createMockRequest('OPTIONS');
      const response = await handler(req, mockContext);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    });

    it('should reject non-POST methods', async () => {
      const req = createMockRequest('GET');
      const response = await handler(req, mockContext);

      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('input validation', () => {
    it('should reject empty message', async () => {
      const req = createMockRequest('POST', {
        message: '',
        models: { openai: 'gpt-4o-mini' },
      });
      const response = await handler(req, mockContext);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Message is required');
    });

    it('should reject whitespace-only message', async () => {
      const req = createMockRequest('POST', {
        message: '   ',
        models: { openai: 'gpt-4o-mini' },
      });
      const response = await handler(req, mockContext);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Message is required');
    });

    it('should reject missing message', async () => {
      const req = createMockRequest('POST', {
        models: { openai: 'gpt-4o-mini' },
      });
      const response = await handler(req, mockContext);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Message is required');
    });
  });

  describe('Gemini integration', () => {
    it('should query Gemini when model is provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }],
          }),
      });

      const req = createMockRequest('POST', {
        message: 'Hello',
        models: { gemini: 'gemini-2.0-flash' },
      });
      const response = await handler(req, mockContext);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results.gemini.ok).toBe(true);
      expect(data.results.gemini.text).toBe('Gemini response');
    });

    it('should return error when Gemini API key is not configured', async () => {
      delete process.env.GEMINI_API_KEY;

      const req = createMockRequest('POST', {
        message: 'Hello',
        models: { gemini: 'gemini-2.0-flash' },
      });
      const response = await handler(req, mockContext);

      const data = await response.json();
      expect(data.results.gemini.ok).toBe(false);
      expect(data.results.gemini.error).toBe('Gemini API key not configured');
    });

    it('should return error when Gemini base URL is not configured', async () => {
      delete process.env.GOOGLE_GEMINI_BASE_URL;

      const req = createMockRequest('POST', {
        message: 'Hello',
        models: { gemini: 'gemini-2.0-flash' },
      });
      const response = await handler(req, mockContext);

      const data = await response.json();
      expect(data.results.gemini.ok).toBe(false);
      expect(data.results.gemini.error).toBe('Gemini base URL not configured');
    });

    it('should handle Gemini API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      });

      const req = createMockRequest('POST', {
        message: 'Hello',
        models: { gemini: 'gemini-2.0-flash' },
      });
      const response = await handler(req, mockContext);

      const data = await response.json();
      expect(data.results.gemini.ok).toBe(false);
      expect(data.results.gemini.error).toContain('Gemini error: 400');
    });

    it('should handle Gemini network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const req = createMockRequest('POST', {
        message: 'Hello',
        models: { gemini: 'gemini-2.0-flash' },
      });
      const response = await handler(req, mockContext);

      const data = await response.json();
      expect(data.results.gemini.ok).toBe(false);
      expect(data.results.gemini.error).toContain('Gemini error');
    });

    it('should send correct request to Gemini API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Response' }] } }],
          }),
      });

      const req = createMockRequest('POST', {
        message: 'Test message',
        models: { gemini: 'gemini-2.0-flash' },
      });
      await handler(req, mockContext);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test-gemini-url.com/v1beta/models/gemini-2.0-flash:generateContent',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-goog-api-key': 'test-gemini-key',
          }),
        })
      );
    });
  });

  describe('response format', () => {
    it('should include CORS headers in response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Response' }] } }],
          }),
      });

      const req = createMockRequest('POST', {
        message: 'Hello',
        models: { gemini: 'gemini-2.0-flash' },
      });
      const response = await handler(req, mockContext);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should return success true with results', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Response' }] } }],
          }),
      });

      const req = createMockRequest('POST', {
        message: 'Hello',
        models: { gemini: 'gemini-2.0-flash' },
      });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.results).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should return 500 on unexpected errors', async () => {
      const req = {
        method: 'POST',
        json: () => Promise.reject(new Error('Parse error')),
      } as Request;

      const response = await handler(req, mockContext);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });
  });
});
