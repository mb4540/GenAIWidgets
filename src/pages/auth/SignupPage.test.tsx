import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SignupPage from './SignupPage';

const mockSignUp = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockTenants = [
  { id: 'tenant-1', name: 'Acme Corp', slug: 'acme' },
  { id: 'tenant-2', name: 'Tech Inc', slug: 'tech' },
];

const renderSignupPage = () => {
  return render(
    <BrowserRouter>
      <SignupPage />
    </BrowserRouter>
  );
};

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, tenants: mockTenants }),
    });
  });

  describe('rendering', () => {
    it('should render the page title', () => {
      renderSignupPage();
      expect(screen.getByText('Create your account')).toBeInTheDocument();
    });

    it('should render full name input field', () => {
      renderSignupPage();
      expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    });

    it('should render organization select field', () => {
      renderSignupPage();
      expect(screen.getByLabelText('Organization')).toBeInTheDocument();
    });

    it('should render email input field', () => {
      renderSignupPage();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    });

    it('should render password input field', () => {
      renderSignupPage();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('should render create account button', () => {
      renderSignupPage();
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    });

    it('should render link to login page', () => {
      renderSignupPage();
      expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth/login');
    });

    it('should show loading state for organizations initially', () => {
      renderSignupPage();
      expect(screen.getByText('Loading organizations...')).toBeInTheDocument();
    });

    it('should load and display organizations', async () => {
      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        expect(screen.getByText('Tech Inc')).toBeInTheDocument();
      });
    });
  });

  describe('form validation', () => {
    it('should have required full name field', () => {
      renderSignupPage();
      expect(screen.getByLabelText('Full name')).toBeRequired();
    });

    it('should have required email field', () => {
      renderSignupPage();
      expect(screen.getByLabelText('Email address')).toBeRequired();
    });

    it('should have required password field', () => {
      renderSignupPage();
      expect(screen.getByLabelText('Password')).toBeRequired();
    });

    it('should show error for password less than 8 characters', async () => {
      const user = userEvent.setup();
      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Full name'), 'John Doe');
      await user.selectOptions(screen.getByLabelText('Organization'), 'tenant-1');
      await user.type(screen.getByLabelText('Email address'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'short');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    it('should require organization selection', async () => {
      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });

      const orgSelect = screen.getByLabelText('Organization');
      expect(orgSelect).toBeRequired();
    });
  });

  describe('form submission', () => {
    it('should call signUp with correct data on submit', async () => {
      const user = userEvent.setup();
      mockSignUp.mockResolvedValue({ success: true });

      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Full name'), 'John Doe');
      await user.selectOptions(screen.getByLabelText('Organization'), 'tenant-1');
      await user.type(screen.getByLabelText('Email address'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'john@example.com',
        password: 'password123',
        fullName: 'John Doe',
        tenantSlug: 'acme',
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      mockSignUp.mockImplementation(() => new Promise(() => {}));

      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Full name'), 'John Doe');
      await user.selectOptions(screen.getByLabelText('Organization'), 'tenant-1');
      await user.type(screen.getByLabelText('Email address'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      expect(screen.getByRole('button', { name: 'Creating account...' })).toBeInTheDocument();
    });

    it('should navigate to dashboard on successful signup', async () => {
      const user = userEvent.setup();
      mockSignUp.mockResolvedValue({ success: true });

      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Full name'), 'John Doe');
      await user.selectOptions(screen.getByLabelText('Organization'), 'tenant-1');
      await user.type(screen.getByLabelText('Email address'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('error handling', () => {
    it('should display error message on failed signup', async () => {
      const user = userEvent.setup();
      mockSignUp.mockResolvedValue({ success: false });

      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Full name'), 'John Doe');
      await user.selectOptions(screen.getByLabelText('Organization'), 'tenant-1');
      await user.type(screen.getByLabelText('Email address'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to create account. Please try again.')).toBeInTheDocument();
      });
    });

    it('should display error message on network error', async () => {
      const user = userEvent.setup();
      mockSignUp.mockRejectedValue(new Error('Network error'));

      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Full name'), 'John Doe');
      await user.selectOptions(screen.getByLabelText('Organization'), 'tenant-1');
      await user.type(screen.getByLabelText('Email address'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByText('An error occurred. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible form labels', () => {
      renderSignupPage();

      expect(screen.getByLabelText('Full name')).toBeInTheDocument();
      expect(screen.getByLabelText('Organization')).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('should have autocomplete attributes', () => {
      renderSignupPage();

      expect(screen.getByLabelText('Full name')).toHaveAttribute('autocomplete', 'name');
      expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'email');
      expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    });

    it('should show password requirements hint', () => {
      renderSignupPage();
      expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument();
    });
  });
});
