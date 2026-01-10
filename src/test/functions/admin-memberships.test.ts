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

import handler from '../../../netlify/functions/admin-memberships';

const createMockRequest = (method: string, body?: unknown, searchParams?: Record<string, string>): Request => {
  const url = new URL('http://localhost/.netlify/functions/admin-memberships');
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

describe('admin-memberships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authentication', () => {
    it('should return 401 when no authorization header', async () => {
      const req = new Request('http://localhost/.netlify/functions/admin-memberships', {
        method: 'GET',
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 403 when user is not admin', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = createMockRequest('GET');
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });
  });

  describe('GET /admin/memberships', () => {
    it('should return all memberships', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([
          { membership_id: 'm-1', tenant_id: 't-1', tenant_name: 'Tenant One', user_id: 'u-1', user_email: 'user1@test.com', user_name: 'User One', role: 'owner', created_at: '2024-01-01' },
        ]);

      const req = createMockRequest('GET');
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.memberships).toHaveLength(1);
      expect(data.memberships[0].tenantName).toBe('Tenant One');
    });

    it('should filter by tenantId', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([
          { membership_id: 'm-1', tenant_id: 't-1', tenant_name: 'Tenant One', user_id: 'u-1', user_email: 'user1@test.com', user_name: 'User One', role: 'owner', created_at: '2024-01-01' },
        ]);

      const req = createMockRequest('GET', undefined, { tenantId: 't-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.memberships).toHaveLength(1);
    });

    it('should filter by userId', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([
          { membership_id: 'm-1', tenant_id: 't-1', tenant_name: 'Tenant One', user_id: 'u-1', user_email: 'user1@test.com', user_name: 'User One', role: 'member', created_at: '2024-01-01' },
        ]);

      const req = createMockRequest('GET', undefined, { userId: 'u-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.memberships).toHaveLength(1);
    });
  });

  describe('POST /admin/memberships', () => {
    it('should create a new membership', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ membership_id: 'new-m-id', created_at: '2024-01-01' }])
        .mockResolvedValueOnce([{ tenant_name: 'Tenant One', user_email: 'user@test.com', user_name: 'User One' }]);

      const req = createMockRequest('POST', { tenantId: 't-1', userId: 'u-1', role: 'member' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.membership.role).toBe('member');
    });

    it('should return 400 when required fields are missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('POST', { tenantId: 't-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Tenant ID and User ID are required');
    });

    it('should return 409 when membership already exists', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([{ membership_id: 'existing-id' }]);

      const req = createMockRequest('POST', { tenantId: 't-1', userId: 'u-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Membership already exists');
    });
  });

  describe('PUT /admin/memberships', () => {
    it('should update membership role', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([{ membership_id: 'm-1', tenant_id: 't-1', user_id: 'u-1', role: 'owner', created_at: '2024-01-01' }])
        .mockResolvedValueOnce([{ tenant_name: 'Tenant One', user_email: 'user@test.com', user_name: 'User One' }]);

      const req = createMockRequest('PUT', { role: 'owner' }, { id: 'm-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.membership.role).toBe('owner');
    });

    it('should return 400 when id is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('PUT', { role: 'owner' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Membership ID required');
    });

    it('should return 400 when role is invalid', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('PUT', { role: 'invalid' }, { id: 'm-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Valid role is required');
    });
  });

  describe('DELETE /admin/memberships', () => {
    it('should delete a membership', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([{ membership_id: 'm-1' }]);

      const req = createMockRequest('DELETE', undefined, { id: 'm-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(true);
    });

    it('should return 404 when membership not found', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([]);

      const req = createMockRequest('DELETE', undefined, { id: 'nonexistent' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Membership not found');
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for unsupported methods', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('PATCH');
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });
  });
});
