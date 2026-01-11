import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RagStatusFilter from './RagStatusFilter';

describe('RagStatusFilter', () => {
  describe('rendering', () => {
    it('should render all status filter buttons', () => {
      render(
        <RagStatusFilter
          currentFilter="all"
          onFilterChange={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Processing' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Extracted' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Failed' })).toBeInTheDocument();
    });

    it('should highlight the current filter', () => {
      render(
        <RagStatusFilter
          currentFilter="pending"
          onFilterChange={vi.fn()}
        />
      );

      const pendingButton = screen.getByRole('button', { name: 'Pending' });
      expect(pendingButton).toHaveClass('bg-primary');
    });

    it('should not highlight non-selected filters', () => {
      render(
        <RagStatusFilter
          currentFilter="pending"
          onFilterChange={vi.fn()}
        />
      );

      const allButton = screen.getByRole('button', { name: 'All' });
      expect(allButton).toHaveClass('bg-muted');
    });
  });

  describe('interactions', () => {
    it('should call onFilterChange when a filter is clicked', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();

      render(
        <RagStatusFilter
          currentFilter="all"
          onFilterChange={onFilterChange}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Pending' }));

      expect(onFilterChange).toHaveBeenCalledWith('pending');
    });

    it('should call onFilterChange with correct status for each button', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();

      render(
        <RagStatusFilter
          currentFilter="all"
          onFilterChange={onFilterChange}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Processing' }));
      expect(onFilterChange).toHaveBeenCalledWith('processing');

      await user.click(screen.getByRole('button', { name: 'Extracted' }));
      expect(onFilterChange).toHaveBeenCalledWith('extracted');

      await user.click(screen.getByRole('button', { name: 'Failed' }));
      expect(onFilterChange).toHaveBeenCalledWith('failed');

      await user.click(screen.getByRole('button', { name: 'All' }));
      expect(onFilterChange).toHaveBeenCalledWith('all');
    });
  });
});
