import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const TOKEN_KEY = 'auth_token';

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  fullName: 'Test User',
  createdAt: '2024-01-01T00:00:00.000Z',
};

const mockTenant = {
  id: 'test-tenant-id',
  name: 'Test Tenant',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('AuthClient', () => {
  let AuthClient: typeof import('./auth-client').auth;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    const module = await import('./auth-client');
    AuthClient = module.auth;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with token from localStorage', async () => {
      localStorage.setItem(TOKEN_KEY, 'existing-token');
      vi.resetModules();
      const module = await import('./auth-client');
      expect(module.auth.getToken()).toBe('existing-token');
    });

    it('should initialize with null token when localStorage is empty', () => {
      expect(AuthClient.getToken()).toBeNull();
    });
  });

  describe('signUp', () => {
    it('should successfully sign up and store token', async () => {
      const mockResponse = {
        success: true,
        token: 'new-token',
        user: mockUser,
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await AuthClient.signUp({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
      });

      expect(result.success).toBe(true);
      expect(result.token).toBe('new-token');
      expect(localStorage.getItem(TOKEN_KEY)).toBe('new-token');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/signup',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle signup failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Email already exists',
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 400,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await AuthClient.signUp({
        email: 'existing@example.com',
        password: 'password123',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
      });

      expect(result.success).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });
  });

  describe('signInWithPassword', () => {
    it('should successfully sign in and store token', async () => {
      const mockResponse = {
        success: true,
        token: 'signin-token',
        user: mockUser,
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await AuthClient.signInWithPassword('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.token).toBe('signin-token');
      expect(localStorage.getItem(TOKEN_KEY)).toBe('signin-token');
    });

    it('should handle invalid credentials', async () => {
      const mockResponse = {
        success: false,
        error: 'Invalid credentials',
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await AuthClient.signInWithPassword('test@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });
  });

  describe('signOut', () => {
    it('should clear token and user data', async () => {
      localStorage.setItem(TOKEN_KEY, 'existing-token');
      vi.resetModules();
      const module = await import('./auth-client');
      const client = module.auth;

      await client.signOut();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(client.getUser()).toBeNull();
      expect(client.getTenant()).toBeNull();
    });
  });

  describe('getSession', () => {
    it('should return null when no token exists', async () => {
      const session = await AuthClient.getSession();
      expect(session).toBeNull();
    });

    it('should fetch and return session when token exists', async () => {
      localStorage.setItem(TOKEN_KEY, 'valid-token');
      vi.resetModules();
      const module = await import('./auth-client');
      const client = module.auth;

      const mockResponse = {
        success: true,
        user: mockUser,
        tenant: mockTenant,
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const session = await client.getSession();

      expect(session).toEqual({ user: mockUser, tenant: mockTenant });
      expect(client.getUser()).toEqual(mockUser);
      expect(client.getTenant()).toEqual(mockTenant);
    });

    it('should clear token on failed session fetch', async () => {
      localStorage.setItem(TOKEN_KEY, 'invalid-token');
      vi.resetModules();
      const module = await import('./auth-client');
      const client = module.auth;

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const session = await client.getSession();

      expect(session).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });
  });

  describe('onAuthStateChange', () => {
    it('should notify listeners on auth state change', async () => {
      const callback = vi.fn();
      const unsubscribe = AuthClient.onAuthStateChange(callback);

      const mockResponse = {
        success: true,
        token: 'new-token',
        user: mockUser,
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await AuthClient.signInWithPassword('test@example.com', 'password123');

      expect(callback).toHaveBeenCalledWith(mockUser, null);

      unsubscribe();
    });

    it('should stop notifying after unsubscribe', async () => {
      const callback = vi.fn();
      const unsubscribe = AuthClient.onAuthStateChange(callback);

      unsubscribe();

      const mockResponse = {
        success: true,
        token: 'new-token',
        user: mockUser,
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await AuthClient.signInWithPassword('test@example.com', 'password123');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('401 handling', () => {
    it('should clear auth state on 401 response', async () => {
      localStorage.setItem(TOKEN_KEY, 'expired-token');
      vi.resetModules();
      const module = await import('./auth-client');
      const client = module.auth;

      const callback = vi.fn();
      client.onAuthStateChange(callback);

      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        json: () => Promise.resolve({ success: false, error: 'Unauthorized' }),
      });

      await client.getSession();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(callback).toHaveBeenCalledWith(null, null);
    });
  });
});
