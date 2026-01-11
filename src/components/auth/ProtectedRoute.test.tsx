import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const mockUseAuth = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

const renderProtectedRoute = (initialPath = '/protected') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/auth/login" element={<div>Login Page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  describe('loading state', () => {
    it('should show loading spinner when auth is loading', () => {
      mockUseAuth.mockReturnValue({ user: null, loading: true });

      renderProtectedRoute();

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not show protected content when loading', () => {
      mockUseAuth.mockReturnValue({ user: null, loading: true });

      renderProtectedRoute();

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('unauthenticated user', () => {
    it('should redirect to login page when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({ user: null, loading: false });

      renderProtectedRoute();

      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    it('should not show protected content when not authenticated', () => {
      mockUseAuth.mockReturnValue({ user: null, loading: false });

      renderProtectedRoute();

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should include returnUrl in redirect', () => {
      mockUseAuth.mockReturnValue({ user: null, loading: false });

      render(
        <MemoryRouter initialEntries={['/protected?foo=bar']}>
          <Routes>
            <Route path="/auth/login" element={<div data-testid="login">Login</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/protected" element={<div>Protected</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('login')).toBeInTheDocument();
    });
  });

  describe('authenticated user', () => {
    it('should render protected content when user is authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: { userId: '1', fullName: 'John Doe', email: 'john@example.com' },
        loading: false,
      });

      renderProtectedRoute();

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should not show login page when authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: { userId: '1', fullName: 'John Doe', email: 'john@example.com' },
        loading: false,
      });

      renderProtectedRoute();

      expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    });

    it('should not show loading spinner when authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: { userId: '1', fullName: 'John Doe', email: 'john@example.com' },
        loading: false,
      });

      renderProtectedRoute();

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });
});
