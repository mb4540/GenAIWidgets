import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('@/lib/auth-client', () => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => vi.fn()),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
}));

import { auth } from '@/lib/auth-client';

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  fullName: 'Test User',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockTenant = {
  id: 'test-tenant-id',
  name: 'Test Tenant',
  slug: 'test-tenant',
  role: 'owner' as const,
};

function TestConsumer() {
  const { user, tenant, loading, signIn, signOut, signUp } = useAuth();

  if (loading) {
    return <div data-testid="loading">Loading...</div>;
  }

  return (
    <div>
      <div data-testid="user">{user ? user.email : 'No user'}</div>
      <div data-testid="tenant">{tenant ? tenant.name : 'No tenant'}</div>
      <button onClick={() => signIn('test@example.com', 'password')}>Sign In</button>
      <button onClick={() => signOut()}>Sign Out</button>
      <button
        onClick={() =>
          signUp({
            email: 'new@example.com',
            password: 'password',
            fullName: 'New User',
            tenantName: 'New Tenant',
          })
        }
      >
        Sign Up
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue(null);
    vi.mocked(auth.onAuthStateChange).mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AuthProvider', () => {
    it('should show loading state initially', async () => {
      vi.mocked(auth.getSession).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 100))
      );

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('should initialize with no user when no session exists', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('user')).toHaveTextContent('No user');
      expect(screen.getByTestId('tenant')).toHaveTextContent('No tenant');
    });

    it('should initialize with user when session exists', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({
        user: mockUser,
        tenant: mockTenant,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      });

      expect(screen.getByTestId('tenant')).toHaveTextContent('Test Tenant');
    });

    it('should subscribe to auth state changes', async () => {
      const unsubscribe = vi.fn();
      vi.mocked(auth.onAuthStateChange).mockReturnValue(unsubscribe);

      const { unmount } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      expect(auth.onAuthStateChange).toHaveBeenCalled();

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should update state when auth state changes', async () => {
      let authCallback: ((user: typeof mockUser | null, tenant: typeof mockTenant | null) => void) | null = null;

      vi.mocked(auth.onAuthStateChange).mockImplementation((callback) => {
        authCallback = callback;
        return vi.fn();
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('user')).toHaveTextContent('No user');

      act(() => {
        authCallback?.(mockUser, mockTenant);
      });

      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('tenant')).toHaveTextContent('Test Tenant');
    });
  });

  describe('useAuth', () => {
    it('should throw error when used outside AuthProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => render(<TestConsumer />)).toThrow(
        'useAuth must be used within an AuthProvider'
      );

      consoleError.mockRestore();
    });

    it('should call auth.signInWithPassword on signIn', async () => {
      const user = userEvent.setup();
      vi.mocked(auth.signInWithPassword).mockResolvedValue({
        success: true,
        token: 'token',
        user: mockUser,
        tenantId: mockTenant.id,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      await user.click(screen.getByText('Sign In'));

      expect(auth.signInWithPassword).toHaveBeenCalledWith('test@example.com', 'password');
    });

    it('should call auth.signOut on signOut', async () => {
      const user = userEvent.setup();
      vi.mocked(auth.signOut).mockResolvedValue(undefined);

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      await user.click(screen.getByText('Sign Out'));

      expect(auth.signOut).toHaveBeenCalled();
    });

    it('should call auth.signUp on signUp', async () => {
      const user = userEvent.setup();
      vi.mocked(auth.signUp).mockResolvedValue({
        success: true,
        token: 'token',
        user: mockUser,
        tenantId: mockTenant.id,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      await user.click(screen.getByText('Sign Up'));

      expect(auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password',
        fullName: 'New User',
        tenantName: 'New Tenant',
      });
    });
  });
});
