import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
const mockBlobDelete = vi.fn();

vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
}));

vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    delete: mockBlobDelete,
  }),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'test-user-id', email: 'test@example.com', tenantId: 'test-tenant-id' })),
    JsonWebTokenError: class JsonWebTokenError extends Error {},
  },
}));

import handler from '../../../netlify/functions/files-delete';

const createMockRequest = (searchParams?: Record<string, string>): Request => {
  const url = new URL('http://localhost/.netlify/functions/files-delete');
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return new Request(url.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer valid-token',
    },
  });
};

const mockContext = {} as Parameters<typeof handler>[1];

describe('files-delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.JWT_SECRET = 'test-secret';
    mockBlobDelete.mockResolvedValue(undefined);
  });

  describe('authentication', () => {
    it('should return 401 when no authorization header', async () => {
      const req = new Request('http://localhost/.netlify/functions/files-delete', {
        method: 'DELETE',
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('method validation', () => {
    it('should return 405 for non-DELETE methods', async () => {
      const req = new Request('http://localhost/.netlify/functions/files-delete', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('DELETE /files/delete', () => {
    it('should return 400 when file id is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = createMockRequest();
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('File ID required');
    });

    it('should return 404 when file not found', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([]);

      const req = createMockRequest({ id: 'nonexistent' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('File not found');
    });

    it('should return 403 when non-admin tries to delete other tenant file', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([{ file_id: 'f-1', tenant_id: 'other-tenant', blob_key: 'blob-1' }]);

      const req = createMockRequest({ id: 'f-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should delete file successfully', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([{ file_id: 'f-1', tenant_id: 'test-tenant-id', blob_key: 'blob-1' }])
        .mockResolvedValueOnce([]);

      const req = createMockRequest({ id: 'f-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(true);
      expect(mockBlobDelete).toHaveBeenCalledWith('blob-1');
    });

    it('should allow admin to delete other tenant files', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([{ file_id: 'f-1', tenant_id: 'other-tenant', blob_key: 'blob-1' }])
        .mockResolvedValueOnce([]);

      const req = createMockRequest({ id: 'f-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
