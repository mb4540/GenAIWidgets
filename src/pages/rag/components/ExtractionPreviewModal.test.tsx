import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExtractionPreviewModal from './ExtractionPreviewModal';
import type { ExtractedContent } from './ExtractionPreviewModal';

const createMockContent = (overrides?: Partial<ExtractedContent>): ExtractedContent => ({
  title: 'Test Document',
  fullText: 'This is the extracted content from the document.',
  ...overrides,
});

describe('ExtractionPreviewModal', () => {
  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <ExtractionPreviewModal
          isOpen={false}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={createMockContent()}
          fileName="test.pdf"
        />
      );

      expect(screen.queryByText('Review Extracted Content')).not.toBeInTheDocument();
    });

    it('should not render when extractedContent is null', () => {
      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={null}
          fileName="test.pdf"
        />
      );

      expect(screen.queryByText('Review Extracted Content')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true and content exists', () => {
      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={createMockContent()}
          fileName="test.pdf"
        />
      );

      expect(screen.getByText('Review Extracted Content')).toBeInTheDocument();
    });

    it('should display file name', () => {
      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={createMockContent()}
          fileName="my-document.pdf"
        />
      );

      expect(screen.getByText('my-document.pdf')).toBeInTheDocument();
    });

    it('should display document title when provided', () => {
      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={createMockContent({ title: 'Important Report' })}
          fileName="test.pdf"
        />
      );

      expect(screen.getByText('Important Report')).toBeInTheDocument();
    });

    it('should display warning when provided', () => {
      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={createMockContent()}
          fileName="test.pdf"
          warning="Some content may be missing"
        />
      );

      expect(screen.getByText('Some content may be missing')).toBeInTheDocument();
    });

    it('should display page count', () => {
      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={createMockContent({
            pages: [
              { pageNumber: 1, text: 'Page 1 content' },
              { pageNumber: 2, text: 'Page 2 content' },
              { pageNumber: 3, text: 'Page 3 content' },
            ],
          })}
          fileName="test.pdf"
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display extracted content in textarea', () => {
      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={createMockContent({ fullText: 'Sample extracted text' })}
          fileName="test.pdf"
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toContain('Sample extracted text');
    });

    it('should render Cancel and Accept buttons', () => {
      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={createMockContent()}
          fileName="test.pdf"
        />
      );

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Accept/i })).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={onClose}
          onAccept={vi.fn()}
          extractedContent={createMockContent()}
          fileName="test.pdf"
        />
      );

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when X button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={onClose}
          onAccept={vi.fn()}
          extractedContent={createMockContent()}
          fileName="test.pdf"
        />
      );

      const closeButtons = screen.getAllByRole('button');
      const xButton = closeButtons.find(btn => btn.querySelector('svg'));
      if (xButton) {
        await user.click(xButton);
      }

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onAccept with content when Accept button is clicked', async () => {
      const user = userEvent.setup();
      const onAccept = vi.fn();

      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={onAccept}
          extractedContent={createMockContent({ fullText: 'Test content' })}
          fileName="test.pdf"
        />
      );

      await user.click(screen.getByRole('button', { name: /Accept/i }));

      expect(onAccept).toHaveBeenCalledWith(expect.stringContaining('Test content'));
    });

    it('should allow editing the content', async () => {
      const user = userEvent.setup();

      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={createMockContent({ fullText: 'Original' })}
          fileName="test.pdf"
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Edited content');

      expect(textarea).toHaveValue('Edited content');
    });

    it('should call onAccept with edited content', async () => {
      const user = userEvent.setup();
      const onAccept = vi.fn();

      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={onAccept}
          extractedContent={createMockContent({ fullText: 'Original' })}
          fileName="test.pdf"
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'New content');
      await user.click(screen.getByRole('button', { name: /Accept/i }));

      expect(onAccept).toHaveBeenCalledWith('New content');
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={onClose}
          onAccept={vi.fn()}
          extractedContent={createMockContent()}
          fileName="test.pdf"
        />
      );

      const backdrop = document.querySelector('.bg-black\\/50');
      if (backdrop) {
        await user.click(backdrop);
      }

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('content formatting', () => {
    it('should format content with title', () => {
      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={createMockContent({ title: 'My Title', fullText: 'Body text' })}
          fileName="test.pdf"
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toContain('# My Title');
    });

    it('should format content with pages', () => {
      render(
        <ExtractionPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          onAccept={vi.fn()}
          extractedContent={{
            pages: [
              { pageNumber: 1, text: 'First page' },
              { pageNumber: 2, text: 'Second page' },
            ],
          }}
          fileName="test.pdf"
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toContain('First page');
      expect(textarea.value).toContain('Second page');
    });
  });
});
