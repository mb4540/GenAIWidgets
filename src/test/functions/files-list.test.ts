import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();

vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'test-user-id', email: 'test@example.com', tenantId: 'test-tenant-id' })),
    JsonWebTokenError: class JsonWebTokenError extends Error {},
  },
}));

import handler from '../../../netlify/functions/files-list';

const createMockRequest = (searchParams?: Record<string, string>): Request => {
  const url = new URL('http://localhost/.netlify/functions/files-list');
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

describe('files-list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authentication', () => {
    it('should return 401 when no authorization header', async () => {
      const req = new Request('http://localhost/.netlify/functions/files-list', {
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
      const req = new Request('http://localhost/.netlify/functions/files-list', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('GET /files/list', () => {
    it('should return files and folders for authenticated user', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([
          { file_id: 'f-1', tenant_id: 'test-tenant-id', user_id: 'test-user-id', blob_key: 'blob-1', file_name: 'test.txt', file_path: '/', mime_type: 'text/plain', file_size: 100, created_at: '2024-01-01', updated_at: '2024-01-01' },
        ])
        .mockResolvedValueOnce([
          { folder_id: 'folder-1', tenant_id: 'test-tenant-id', folder_name: 'Documents', folder_path: '/Documents/', parent_path: '/', created_at: '2024-01-01' },
        ]);

      const req = createMockRequest();
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.files).toHaveLength(1);
      expect(data.folders).toHaveLength(1);
      expect(data.files[0].name).toBe('test.txt');
      expect(data.folders[0].name).toBe('Documents');
    });

    it('should filter by path parameter', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const req = createMockRequest({ path: '/Documents/' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.path).toBe('/Documents/');
    });

    it('should allow admin to access other tenant files', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const req = createMockRequest({ tenantId: 'other-tenant-id' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tenantId).toBe('other-tenant-id');
    });

    it('should use user tenant when non-admin does not specify tenantId', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const req = createMockRequest();
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tenantId).toBe('test-tenant-id');
    });
  });
});
