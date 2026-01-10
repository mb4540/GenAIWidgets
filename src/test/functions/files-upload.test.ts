import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
const mockBlobSet = vi.fn();

vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
}));

vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    set: mockBlobSet,
  }),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'test-user-id', email: 'test@example.com', tenantId: 'test-tenant-id' })),
    JsonWebTokenError: class JsonWebTokenError extends Error {},
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

import handler from '../../../netlify/functions/files-upload';

const mockContext = {} as Parameters<typeof handler>[1];

describe('files-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.JWT_SECRET = 'test-secret';
    mockBlobSet.mockResolvedValue({ etag: 'test-etag' });
  });

  describe('authentication', () => {
    it('should return 401 when no authorization header', async () => {
      const req = new Request('http://localhost/.netlify/functions/files-upload', {
        method: 'POST',
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('method validation', () => {
    it('should return 405 for non-POST methods', async () => {
      const req = new Request('http://localhost/.netlify/functions/files-upload', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('POST /files/upload', () => {
    it('should return 400 when content-type is not multipart/form-data', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = new Request('http://localhost/.netlify/functions/files-upload', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Content-Type must be multipart/form-data');
    });

    it('should return 400 when no file provided', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const formData = new FormData();
      formData.append('path', '/');

      const req = new Request('http://localhost/.netlify/functions/files-upload', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: formData,
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No file provided');
    });
  });
});
