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

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(() => Promise.resolve('hashed-password')),
  },
}));

import handler from '../../../netlify/functions/admin-users';

const createMockRequest = (method: string, body?: unknown, searchParams?: Record<string, string>): Request => {
  const url = new URL('http://localhost/.netlify/functions/admin-users');
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

describe('admin-users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authentication', () => {
    it('should return 401 when no authorization header', async () => {
      const req = new Request('http://localhost/.netlify/functions/admin-users', {
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

  describe('GET /admin/users', () => {
    it('should return list of users for admin', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([
          { user_id: 'user-1', email: 'user1@test.com', full_name: 'User One', phone: null, is_admin: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
          { user_id: 'user-2', email: 'user2@test.com', full_name: 'User Two', phone: '123', is_admin: true, created_at: '2024-01-02', updated_at: '2024-01-02' },
        ]);

      const req = createMockRequest('GET');
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.users).toHaveLength(2);
      expect(data.users[0].email).toBe('user1@test.com');
      expect(data.users[1].isAdmin).toBe(true);
    });
  });

  describe('POST /admin/users', () => {
    it('should create a new user', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { user_id: 'new-user-id', email: 'new@test.com', full_name: 'New User', phone: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
        ]);

      const req = createMockRequest('POST', { email: 'new@test.com', password: 'password123', fullName: 'New User' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('new@test.com');
    });

    it('should create admin user when isAdmin is true', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { user_id: 'new-admin-id', email: 'admin@test.com', full_name: 'New Admin', phone: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
        ])
        .mockResolvedValueOnce([]);

      const req = createMockRequest('POST', { email: 'admin@test.com', password: 'password123', fullName: 'New Admin', isAdmin: true });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.user.isAdmin).toBe(true);
    });

    it('should return 400 when required fields are missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('POST', { email: 'test@test.com' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email, password, and full name are required');
    });

    it('should return 400 when password is too short', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('POST', { email: 'test@test.com', password: 'short', fullName: 'Test' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password must be at least 8 characters');
    });

    it('should return 409 when email already exists', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([{ user_id: 'existing-id' }]);

      const req = createMockRequest('POST', { email: 'existing@test.com', password: 'password123', fullName: 'Test' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Email already registered');
    });
  });

  describe('PUT /admin/users', () => {
    it('should update user and toggle admin status', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { user_id: 'user-1', email: 'user@test.com', full_name: 'Updated Name', phone: null, is_admin: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
        ]);

      const req = createMockRequest('PUT', { fullName: 'Updated Name', isAdmin: true }, { id: 'user-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.fullName).toBe('Updated Name');
    });

    it('should return 400 when id is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('PUT', { fullName: 'Test' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('User ID required');
    });
  });

  describe('DELETE /admin/users', () => {
    it('should delete a user', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([{ user_id: 'user-to-delete' }]);

      const req = createMockRequest('DELETE', undefined, { id: 'user-to-delete' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(true);
    });

    it('should return 400 when trying to delete yourself', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: true }]);

      const req = createMockRequest('DELETE', undefined, { id: 'test-user-id' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot delete yourself');
    });

    it('should return 404 when user not found', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: true }])
        .mockResolvedValueOnce([]);

      const req = createMockRequest('DELETE', undefined, { id: 'nonexistent' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
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
