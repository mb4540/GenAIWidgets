import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AdminPage from './AdminPage';

const mockUser = {
  id: 'test-user-id',
  email: 'admin@test.com',
  fullName: 'Admin User',
  isAdmin: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const mockNonAdminUser = {
  ...mockUser,
  isAdmin: false,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    tenant: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.setItem('auth_token', 'test-token');
  });

  describe('access control', () => {
    it('should redirect non-admin users to dashboard', async () => {
      const { useAuth } = await import('@/contexts/AuthContext');
      vi.mocked(useAuth).mockReturnValue({
        user: mockNonAdminUser,
        tenant: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      renderWithRouter(<AdminPage />);

      expect(screen.getByTestId('navigate')).toHaveTextContent('/dashboard');
    });
  });

  describe('admin user view', () => {
    beforeEach(async () => {
      const { useAuth } = await import('@/contexts/AuthContext');
      vi.mocked(useAuth).mockReturnValue({
        user: mockUser,
        tenant: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, tenants: [] }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, users: [] }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, memberships: [] }),
        });
    });

    it('should render admin dashboard title', async () => {
      renderWithRouter(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });
    });

    it('should render tabs for tenants, users, and memberships', async () => {
      renderWithRouter(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('Tenants')).toBeInTheDocument();
        expect(screen.getByText('Users')).toBeInTheDocument();
        expect(screen.getByText('Memberships')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      renderWithRouter(<AdminPage />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should switch tabs when clicked', async () => {
      renderWithRouter(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('Organizations')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Users'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
      });
    });
  });

  describe('tenants tab', () => {
    beforeEach(async () => {
      const { useAuth } = await import('@/contexts/AuthContext');
      vi.mocked(useAuth).mockReturnValue({
        user: mockUser,
        tenant: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            success: true,
            tenants: [{ id: 't-1', name: 'Test Tenant', slug: 'test-tenant', createdAt: '2024-01-01' }],
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, users: [] }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, memberships: [] }),
        });
    });

    it('should display tenants list', async () => {
      renderWithRouter(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Tenant')).toBeInTheDocument();
      });
    });

    it('should show add tenant button', async () => {
      renderWithRouter(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add tenant/i })).toBeInTheDocument();
      });
    });

    it('should show create tenant form when add button clicked', async () => {
      renderWithRouter(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add tenant/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add tenant/i }));

      expect(screen.getByPlaceholderText('Tenant name')).toBeInTheDocument();
    });
  });

  describe('users tab', () => {
    beforeEach(async () => {
      const { useAuth } = await import('@/contexts/AuthContext');
      vi.mocked(useAuth).mockReturnValue({
        user: mockUser,
        tenant: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, tenants: [] }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            success: true,
            users: [{ id: 'u-1', email: 'user@test.com', fullName: 'Test User', phone: null, isAdmin: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' }],
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, memberships: [] }),
        });
    });

    it('should display users list when users tab is active', async () => {
      renderWithRouter(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('Tenants')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Users'));

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('user@test.com')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should display error message when fetch fails', async () => {
      const { useAuth } = await import('@/contexts/AuthContext');
      vi.mocked(useAuth).mockReturnValue({
        user: mockUser,
        tenant: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      renderWithRouter(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
      });
    });

    it('should allow dismissing error message', async () => {
      const { useAuth } = await import('@/contexts/AuthContext');
      vi.mocked(useAuth).mockReturnValue({
        user: mockUser,
        tenant: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      renderWithRouter(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Dismiss'));

      await waitFor(() => {
        expect(screen.queryByText(/failed to fetch/i)).not.toBeInTheDocument();
      });
    });
  });
});
