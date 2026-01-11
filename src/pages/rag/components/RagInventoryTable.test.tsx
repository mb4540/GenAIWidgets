import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RagInventoryTable from './RagInventoryTable';
import type { InventoryItem } from './RagInventoryRow';

const mockFormatFileSize = (bytes: number | null): string => {
  if (bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const createMockItem = (overrides?: Partial<InventoryItem>): InventoryItem => ({
  id: 'test-id-1',
  tenantId: 'tenant-1',
  sourceStore: 'files',
  blobKey: 'path/to/file.pdf',
  fileName: 'test-file.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  status: 'pending',
  discoveredAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('RagInventoryTable', () => {
  describe('rendering', () => {
    it('should render table headers', () => {
      render(
        <RagInventoryTable
          inventory={[]}
          onRetry={vi.fn()}
          formatFileSize={mockFormatFileSize}
        />
      );

      expect(screen.getByText('File Name')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Discovered')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should render empty state when no inventory items', () => {
      render(
        <RagInventoryTable
          inventory={[]}
          onRetry={vi.fn()}
          formatFileSize={mockFormatFileSize}
        />
      );

      expect(screen.getByText('No files in inventory')).toBeInTheDocument();
    });

    it('should render inventory items', () => {
      const items: InventoryItem[] = [
        createMockItem({ id: '1', fileName: 'document.pdf' }),
        createMockItem({ id: '2', fileName: 'report.docx' }),
      ];

      render(
        <RagInventoryTable
          inventory={items}
          onRetry={vi.fn()}
          formatFileSize={mockFormatFileSize}
        />
      );

      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('report.docx')).toBeInTheDocument();
    });

    it('should display file size using formatFileSize function', () => {
      const items: InventoryItem[] = [
        createMockItem({ sizeBytes: 2048 }),
      ];

      render(
        <RagInventoryTable
          inventory={items}
          onRetry={vi.fn()}
          formatFileSize={mockFormatFileSize}
        />
      );

      expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    });

    it('should display mime type', () => {
      const items: InventoryItem[] = [
        createMockItem({ mimeType: 'application/pdf' }),
      ];

      render(
        <RagInventoryTable
          inventory={items}
          onRetry={vi.fn()}
          formatFileSize={mockFormatFileSize}
        />
      );

      expect(screen.getByText('application/pdf')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onRetry when retry button is clicked for failed item', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      const items: InventoryItem[] = [
        createMockItem({ id: 'failed-item', status: 'failed' }),
      ];

      render(
        <RagInventoryTable
          inventory={items}
          onRetry={onRetry}
          formatFileSize={mockFormatFileSize}
        />
      );

      const retryButton = screen.getByTitle('Retry');
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledWith('failed-item');
    });

    it('should call onRetry when extract button is clicked for pending item', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      const items: InventoryItem[] = [
        createMockItem({ id: 'pending-item', status: 'pending' }),
      ];

      render(
        <RagInventoryTable
          inventory={items}
          onRetry={onRetry}
          formatFileSize={mockFormatFileSize}
        />
      );

      const extractButton = screen.getByTitle('Extract');
      await user.click(extractButton);

      expect(onRetry).toHaveBeenCalledWith('pending-item');
    });

    it('should call onViewContent when view button is clicked for extracted item', async () => {
      const user = userEvent.setup();
      const onViewContent = vi.fn();
      const item = createMockItem({ id: 'extracted-item', status: 'extracted' });

      render(
        <RagInventoryTable
          inventory={[item]}
          onRetry={vi.fn()}
          onViewContent={onViewContent}
          formatFileSize={mockFormatFileSize}
        />
      );

      const viewButton = screen.getByTitle('View extracted content');
      await user.click(viewButton);

      expect(onViewContent).toHaveBeenCalledWith(item);
    });
  });

  describe('status display', () => {
    it('should show Pending status badge for pending items', () => {
      const items: InventoryItem[] = [
        createMockItem({ status: 'pending' }),
      ];

      render(
        <RagInventoryTable
          inventory={items}
          onRetry={vi.fn()}
          formatFileSize={mockFormatFileSize}
        />
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should show Extracted status badge for extracted items', () => {
      const items: InventoryItem[] = [
        createMockItem({ status: 'extracted' }),
      ];

      render(
        <RagInventoryTable
          inventory={items}
          onRetry={vi.fn()}
          formatFileSize={mockFormatFileSize}
        />
      );

      expect(screen.getByText('Extracted')).toBeInTheDocument();
    });

    it('should show Failed status badge for failed items', () => {
      const items: InventoryItem[] = [
        createMockItem({ status: 'failed' }),
      ];

      render(
        <RagInventoryTable
          inventory={items}
          onRetry={vi.fn()}
          formatFileSize={mockFormatFileSize}
        />
      );

      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('should show Processing status badge for processing items', () => {
      const items: InventoryItem[] = [
        createMockItem({ status: 'processing' }),
      ];

      render(
        <RagInventoryTable
          inventory={items}
          onRetry={vi.fn()}
          formatFileSize={mockFormatFileSize}
        />
      );

      expect(screen.getByText('Processing')).toBeInTheDocument();
    });
  });
});
