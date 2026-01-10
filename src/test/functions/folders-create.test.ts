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

import handler from '../../../netlify/functions/folders-create';

const createMockRequest = (body?: unknown): Request => {
  return new Request('http://localhost/.netlify/functions/folders-create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer valid-token',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
};

const mockContext = {} as Parameters<typeof handler>[1];

describe('folders-create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authentication', () => {
    it('should return 401 when no authorization header', async () => {
      const req = new Request('http://localhost/.netlify/functions/folders-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('method validation', () => {
    it('should return 405 for non-POST methods', async () => {
      const req = new Request('http://localhost/.netlify/functions/folders-create', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('POST /folders/create', () => {
    it('should create a folder successfully', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ folder_id: 'new-folder-id', created_at: '2024-01-01' }]);

      const req = createMockRequest({ name: 'Documents', parentPath: '/' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.folder.name).toBe('Documents');
      expect(data.folder.path).toBe('/Documents/');
    });

    it('should return 400 when name is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = createMockRequest({ name: '' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Folder name is required');
    });

    it('should return 409 when folder already exists', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([{ folder_id: 'existing-id' }]);

      const req = createMockRequest({ name: 'Existing', parentPath: '/' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Folder already exists');
    });

    it('should sanitize folder name', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ folder_id: 'new-folder-id', created_at: '2024-01-01' }]);

      const req = createMockRequest({ name: 'Test/Folder\\Name', parentPath: '/' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.folder.name).toBe('Test-Folder-Name');
    });

    it('should allow admin to create folder in other tenant', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ folder_id: 'new-folder-id', created_at: '2024-01-01' }]);

      const req = createMockRequest({ name: 'AdminFolder', parentPath: '/', tenantId: 'other-tenant' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should use user tenant when non-admin does not specify tenantId', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ folder_id: 'new-folder-id', created_at: '2024-01-01' }]);

      const req = createMockRequest({ name: 'Test', parentPath: '/' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
