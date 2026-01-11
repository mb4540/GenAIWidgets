import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from './DashboardPage';

const mockUser = {
  userId: 'user-1',
  email: 'test@example.com',
  fullName: 'John Doe',
};

const mockTenant = {
  tenantId: 'tenant-1',
  name: 'Acme Corp',
  role: 'member',
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    tenant: mockTenant,
  }),
}));

describe('DashboardPage', () => {
  describe('rendering', () => {
    it('should render the page title', () => {
      render(<DashboardPage />);
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });

    it('should render welcome message', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Welcome back!')).toBeInTheDocument();
    });

    it('should display user full name', () => {
      render(<DashboardPage />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display signed in message with user name', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/You are signed in as/)).toBeInTheDocument();
    });

    it('should display tenant name', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('should display tenant role', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/member/)).toBeInTheDocument();
    });

    it('should display organization label', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/Organization:/)).toBeInTheDocument();
    });
  });
});
