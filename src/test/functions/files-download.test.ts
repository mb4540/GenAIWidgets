import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
const mockBlobGet = vi.fn();

vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
}));

vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    get: mockBlobGet,
  }),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'test-user-id', email: 'test@example.com', tenantId: 'test-tenant-id' })),
    JsonWebTokenError: class JsonWebTokenError extends Error {},
  },
}));

import handler from '../../../netlify/functions/files-download';

const createMockRequest = (searchParams?: Record<string, string>): Request => {
  const url = new URL('http://localhost/.netlify/functions/files-download');
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return new Request(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: 'Bearer valid-token',
    },
  });
};

const mockContext = {} as Parameters<typeof handler>[1];

describe('files-download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authentication', () => {
    it('should return 401 when no authorization header', async () => {
      const req = new Request('http://localhost/.netlify/functions/files-download', {
        method: 'GET',
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('method validation', () => {
    it('should return 405 for non-GET methods', async () => {
      const req = new Request('http://localhost/.netlify/functions/files-download', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('GET /files/download', () => {
    it('should return 400 when file id is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = createMockRequest();
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('File ID required');
    });

    it('should return 404 when file not found in database', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([]);

      const req = createMockRequest({ id: 'nonexistent-file' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('File not found');
    });

    it('should return 403 when non-admin tries to access other tenant file', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([{ file_id: 'f-1', tenant_id: 'other-tenant', blob_key: 'blob-1', file_name: 'test.txt', mime_type: 'text/plain' }]);

      const req = createMockRequest({ id: 'f-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should download file successfully', async () => {
      const mockBlob = new Blob(['test content'], { type: 'text/plain' });
      mockBlobGet.mockResolvedValueOnce(mockBlob);
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([{ file_id: 'f-1', tenant_id: 'test-tenant-id', blob_key: 'blob-1', file_name: 'test.txt', mime_type: 'text/plain' }]);

      const req = createMockRequest({ id: 'f-1' });
      const response = await handler(req, mockContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/plain');
      expect(response.headers.get('Content-Disposition')).toContain('test.txt');
    });

    it('should return 404 when blob content not found', async () => {
      mockBlobGet.mockResolvedValueOnce(null);
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([{ file_id: 'f-1', tenant_id: 'test-tenant-id', blob_key: 'blob-1', file_name: 'test.txt', mime_type: 'text/plain' }]);

      const req = createMockRequest({ id: 'f-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('File content not found');
    });

    it('should allow admin to download other tenant files', async () => {
      const mockBlob = new Blob(['test content'], { type: 'text/plain' });
      mockBlobGet.mockResolvedValueOnce(mockBlob);
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([{ file_id: 'f-1', tenant_id: 'other-tenant', blob_key: 'blob-1', file_name: 'test.txt', mime_type: 'text/plain' }]);

      const req = createMockRequest({ id: 'f-1' });
      const response = await handler(req, mockContext);

      expect(response.status).toBe(200);
    });
  });
});
