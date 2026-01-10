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

import handler from '../../../netlify/functions/admin-tenants';

const createMockRequest = (method: string, body?: unknown, searchParams?: Record<string, string>): Request => {
  const url = new URL('http://localhost/.netlify/functions/admin-tenants');
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return new Request(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer valid-token',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
};

const mockContext = {} as Parameters<typeof handler>[1];

describe('admin-tenants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authentication', () => {
    it('should return 401 when no authorization header', async () => {
      const req = new Request('http://localhost/.netlify/functions/admin-tenants', {
        method: 'GET',
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not admin', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = createMockRequest('GET');
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Admin access required');
    });
  });

  describe('GET /admin/tenants', () => {
    it('should return list of tenants for admin user', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([
          { tenant_id: 'tenant-1', name: 'Tenant One', slug: 'tenant-one', created_at: '2024-01-01' },
          { tenant_id: 'tenant-2', name: 'Tenant Two', slug: 'tenant-two', created_at: '2024-01-02' },
        ]);

      const req = createMockRequest('GET');
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tenants).toHaveLength(2);
      expect(data.tenants[0].name).toBe('Tenant One');
    });
  });

  describe('POST /admin/tenants', () => {
    it('should create a new tenant', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { tenant_id: 'new-tenant-id', name: 'New Tenant', slug: 'new-tenant', created_at: '2024-01-01' },
        ]);

      const req = createMockRequest('POST', { name: 'New Tenant' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.tenant.name).toBe('New Tenant');
      expect(data.tenant.slug).toBe('new-tenant');
    });

    it('should return 400 when name is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('POST', { name: '' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Tenant name is required');
    });

    it('should return 409 when tenant already exists', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([{ tenant_id: 'existing-id' }]);

      const req = createMockRequest('POST', { name: 'Existing Tenant' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Tenant with this name already exists');
    });
  });

  describe('PUT /admin/tenants', () => {
    it('should update an existing tenant', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([
          { tenant_id: 'tenant-1', name: 'Updated Tenant', slug: 'updated-tenant', created_at: '2024-01-01' },
        ]);

      const req = createMockRequest('PUT', { name: 'Updated Tenant' }, { id: 'tenant-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tenant.name).toBe('Updated Tenant');
    });

    it('should return 400 when id is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('PUT', { name: 'Updated Tenant' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Tenant ID required');
    });

    it('should return 404 when tenant not found', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([]);

      const req = createMockRequest('PUT', { name: 'Updated Tenant' }, { id: 'nonexistent' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Tenant not found');
    });
  });

  describe('DELETE /admin/tenants', () => {
    it('should delete an existing tenant', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([{ tenant_id: 'tenant-1' }]);

      const req = createMockRequest('DELETE', undefined, { id: 'tenant-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(true);
    });

    it('should return 400 when id is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('DELETE');
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Tenant ID required');
    });

    it('should return 404 when tenant not found', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([]);

      const req = createMockRequest('DELETE', undefined, { id: 'nonexistent' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Tenant not found');
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for unsupported methods', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('PATCH');
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
    });
  });
});
