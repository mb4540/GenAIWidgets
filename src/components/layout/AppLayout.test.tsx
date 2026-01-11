import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';

const mockSignOut = vi.fn();
const mockNavigate = vi.fn();

const mockUser = {
  userId: 'user-1',
  email: 'john@example.com',
  fullName: 'John Doe',
  isAdmin: false,
};

const mockAdminUser = {
  ...mockUser,
  isAdmin: true,
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderAppLayout = () => {
  return render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>
  );
};

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the brand name', () => {
      renderAppLayout();
      expect(screen.getByText('GenAI Widgets')).toBeInTheDocument();
    });

    it('should render Dashboard navigation link', () => {
      renderAppLayout();
      expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    });

    it('should render AI Gateway Chat navigation link', () => {
      renderAppLayout();
      expect(screen.getByRole('link', { name: /AI Gateway Chat/i })).toBeInTheDocument();
    });

    it('should render File Storage navigation link', () => {
      renderAppLayout();
      expect(screen.getByRole('link', { name: /File Storage/i })).toBeInTheDocument();
    });

    it('should render RAG Preprocessing navigation link', () => {
      renderAppLayout();
      expect(screen.getByRole('link', { name: /RAG Preprocessing/i })).toBeInTheDocument();
    });
  });

  describe('user section', () => {
    it('should display user full name', () => {
      renderAppLayout();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display user email', () => {
      renderAppLayout();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('should display user initial in avatar', () => {
      renderAppLayout();
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('should render sign out button', () => {
      renderAppLayout();
      expect(screen.getByTitle('Sign out')).toBeInTheDocument();
    });
  });

  describe('sign out', () => {
    it('should call signOut when sign out button is clicked', async () => {
      const user = userEvent.setup();
      mockSignOut.mockResolvedValue(undefined);

      renderAppLayout();

      await user.click(screen.getByTitle('Sign out'));

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should navigate to home after sign out', async () => {
      const user = userEvent.setup();
      mockSignOut.mockResolvedValue(undefined);

      renderAppLayout();

      await user.click(screen.getByTitle('Sign out'));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('navigation links', () => {
    it('should have correct href for Dashboard', () => {
      renderAppLayout();
      expect(screen.getByRole('link', { name: /Dashboard/i })).toHaveAttribute('href', '/dashboard');
    });

    it('should have correct href for AI Gateway Chat', () => {
      renderAppLayout();
      expect(screen.getByRole('link', { name: /AI Gateway Chat/i })).toHaveAttribute('href', '/ai-gateway-chat');
    });

    it('should have correct href for File Storage', () => {
      renderAppLayout();
      expect(screen.getByRole('link', { name: /File Storage/i })).toHaveAttribute('href', '/files');
    });

    it('should have correct href for RAG Preprocessing', () => {
      renderAppLayout();
      expect(screen.getByRole('link', { name: /RAG Preprocessing/i })).toHaveAttribute('href', '/rag-preprocessing');
    });
  });
});

describe('AppLayout admin navigation', () => {
  it('should not render Admin link for non-admin users', () => {
    renderAppLayout();
    expect(screen.queryByRole('link', { name: /Admin/i })).not.toBeInTheDocument();
  });
});
