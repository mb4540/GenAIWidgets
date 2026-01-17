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

    it('should render welcome message with user name', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/Welcome back,/)).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display tenant info', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
      expect(screen.getByText(/member/)).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      render(<DashboardPage />);
      // The dashboard shows a loading spinner while fetching stats
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });
});
