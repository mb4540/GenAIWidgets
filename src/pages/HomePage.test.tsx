import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import HomePage from './HomePage';

const renderHomePage = (user: { fullName: string } | null = null) => {
  vi.doMock('@/hooks/useAuth', () => ({
    useAuth: () => ({ user }),
  }));

  return render(
    <BrowserRouter>
      <HomePage />
    </BrowserRouter>
  );
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

describe('HomePage', () => {
  describe('rendering', () => {
    it('should render the main title', () => {
      renderHomePage();
      expect(screen.getByRole('heading', { name: 'GenAI Widgets' })).toBeInTheDocument();
    });

    it('should render the description', () => {
      renderHomePage();
      expect(screen.getByText(/A production-ready scaffolding template/)).toBeInTheDocument();
    });
  });

  describe('unauthenticated user', () => {
    it('should render Get started link', () => {
      renderHomePage();
      expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/auth/signup');
    });

    it('should render Sign in link', () => {
      renderHomePage();
      expect(screen.getByRole('link', { name: /Sign in/ })).toHaveAttribute('href', '/auth/login');
    });
  });
});

describe('HomePage with authenticated user', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should render Go to Dashboard link when user is logged in', async () => {
    vi.doMock('@/hooks/useAuth', () => ({
      useAuth: () => ({ user: { fullName: 'John Doe' } }),
    }));

    const { default: HomePage } = await import('./HomePage');

    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/dashboard');
  });
});
