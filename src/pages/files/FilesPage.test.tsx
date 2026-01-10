import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FilesPage from './FilesPage';

const mockUser = {
  id: 'test-user-id',
  email: 'user@test.com',
  fullName: 'Test User',
  isAdmin: false,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const mockAdminUser = {
  ...mockUser,
  isAdmin: true,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    tenant: { id: 'test-tenant-id', name: 'Test Tenant', slug: 'test-tenant', role: 'owner' },
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('FilesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.setItem('auth_token', 'test-token');
  });

  describe('initial render', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          path: '/',
          tenantId: 'test-tenant-id',
          files: [],
          folders: [],
        }),
      });
    });

    it('should render file storage title', async () => {
      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('File Storage')).toBeInTheDocument();
      });
    });

    it('should render upload and new folder buttons', async () => {
      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('Upload')).toBeInTheDocument();
        expect(screen.getByText('New Folder')).toBeInTheDocument();
      });
    });

    it('should show home breadcrumb', async () => {
      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });
    });

    it('should show empty state when no files or folders', async () => {
      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('This folder is empty')).toBeInTheDocument();
      });
    });
  });

  describe('with files and folders', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          path: '/',
          tenantId: 'test-tenant-id',
          files: [
            { id: 'f-1', name: 'document.pdf', path: '/', mimeType: 'application/pdf', size: 1024, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          ],
          folders: [
            { id: 'folder-1', name: 'Documents', path: '/Documents/', createdAt: '2024-01-01' },
          ],
        }),
      });
    });

    it('should display files and folders', async () => {
      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
        expect(screen.getByText('Documents')).toBeInTheDocument();
      });
    });

    it('should display file size', async () => {
      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
      });
    });
  });

  describe('folder navigation', () => {
    it('should navigate into folder when clicked', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            success: true,
            path: '/',
            tenantId: 'test-tenant-id',
            files: [],
            folders: [{ id: 'folder-1', name: 'Documents', path: '/Documents/', createdAt: '2024-01-01' }],
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            success: true,
            path: '/Documents/',
            tenantId: 'test-tenant-id',
            files: [],
            folders: [],
          }),
        });

      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('Documents')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Documents'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('create folder', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          path: '/',
          tenantId: 'test-tenant-id',
          files: [],
          folders: [],
        }),
      });
    });

    it('should show create folder form when button clicked', async () => {
      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('New Folder')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Folder'));

      expect(screen.getByPlaceholderText('Folder name')).toBeInTheDocument();
      expect(screen.getByText('Create')).toBeInTheDocument();
    });

    it('should close form when cancel clicked', async () => {
      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('New Folder')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Folder'));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByPlaceholderText('Folder name')).not.toBeInTheDocument();
    });

    it('should create folder when form submitted', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, folder: { id: 'new-folder', name: 'New Folder', path: '/New Folder/', createdAt: '2024-01-01' } }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            success: true,
            path: '/',
            tenantId: 'test-tenant-id',
            files: [],
            folders: [{ id: 'new-folder', name: 'New Folder', path: '/New Folder/', createdAt: '2024-01-01' }],
          }),
        });

      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('New Folder')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Folder'));
      fireEvent.change(screen.getByPlaceholderText('Folder name'), { target: { value: 'New Folder' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/folders/create', expect.any(Object));
      });
    });
  });

  describe('error handling', () => {
    it('should display error message when fetch fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'Failed to load files' }),
      });

      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load files')).toBeInTheDocument();
      });
    });

    it('should display error when network request fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load files')).toBeInTheDocument();
      });
    });
  });

  describe('admin badge', () => {
    it('should show admin badge for admin users', async () => {
      const { useAuth } = await import('@/contexts/AuthContext');
      vi.mocked(useAuth).mockReturnValue({
        user: mockAdminUser,
        tenant: { id: 'test-tenant-id', name: 'Test Tenant', slug: 'test-tenant', role: 'owner' },
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          path: '/',
          tenantId: 'test-tenant-id',
          files: [],
          folders: [],
        }),
      });

      renderWithRouter(<FilesPage />);

      await waitFor(() => {
        expect(screen.getByText('Admin')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('should show loading indicator while fetching', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

      renderWithRouter(<FilesPage />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });
});
