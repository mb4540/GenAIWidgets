import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

const mockSignIn = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the page title', () => {
      renderLoginPage();
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    it('should render email input field', () => {
      renderLoginPage();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    });

    it('should render password input field', () => {
      renderLoginPage();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('should render sign in button', () => {
      renderLoginPage();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('should render link to signup page', () => {
      renderLoginPage();
      expect(screen.getByRole('link', { name: 'create a new account' })).toHaveAttribute('href', '/auth/signup');
    });
  });

  describe('form validation', () => {
    it('should have required email field', () => {
      renderLoginPage();
      const emailInput = screen.getByLabelText('Email address');
      expect(emailInput).toBeRequired();
    });

    it('should have required password field', () => {
      renderLoginPage();
      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toBeRequired();
    });

    it('should have email type on email input', () => {
      renderLoginPage();
      const emailInput = screen.getByLabelText('Email address');
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('should have password type on password input', () => {
      renderLoginPage();
      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('form submission', () => {
    it('should call signIn with email and password on submit', async () => {
      const user = userEvent.setup();
      mockSignIn.mockResolvedValue({ success: true });

      renderLoginPage();

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      mockSignIn.mockImplementation(() => new Promise(() => {}));

      renderLoginPage();

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(screen.getByRole('button', { name: 'Signing in...' })).toBeInTheDocument();
    });

    it('should disable button during submission', async () => {
      const user = userEvent.setup();
      mockSignIn.mockImplementation(() => new Promise(() => {}));

      renderLoginPage();

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    });

    it('should navigate to dashboard on successful login', async () => {
      const user = userEvent.setup();
      mockSignIn.mockResolvedValue({ success: true });

      renderLoginPage();

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('error handling', () => {
    it('should display error message on failed login', async () => {
      const user = userEvent.setup();
      mockSignIn.mockResolvedValue({ success: false });

      renderLoginPage();

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      });
    });

    it('should display error message on network error', async () => {
      const user = userEvent.setup();
      mockSignIn.mockRejectedValue(new Error('Network error'));

      renderLoginPage();

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByText('An error occurred. Please try again.')).toBeInTheDocument();
      });
    });

    it('should clear error on new submission', async () => {
      const user = userEvent.setup();
      mockSignIn.mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true });

      renderLoginPage();

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      });

      await user.clear(screen.getByLabelText('Password'));
      await user.type(screen.getByLabelText('Password'), 'correctpassword');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible form labels', () => {
      renderLoginPage();

      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('should have autocomplete attributes', () => {
      renderLoginPage();

      expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'email');
      expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    });
  });
});
