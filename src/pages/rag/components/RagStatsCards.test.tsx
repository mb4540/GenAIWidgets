import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RagStatsCards from './RagStatsCards';

describe('RagStatsCards', () => {
  describe('rendering', () => {
    it('should render all four stat cards', () => {
      render(
        <RagStatsCards
          totalFiles={100}
          pending={25}
          completed={60}
          failed={15}
        />
      );

      expect(screen.getByText('Total Files')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Extracted')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('should display correct values for each stat', () => {
      render(
        <RagStatsCards
          totalFiles={100}
          pending={25}
          completed={60}
          failed={15}
        />
      );

      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should display zero values correctly', () => {
      render(
        <RagStatsCards
          totalFiles={0}
          pending={0}
          completed={0}
          failed={0}
        />
      );

      const zeros = screen.getAllByText('0');
      expect(zeros).toHaveLength(4);
    });

    it('should display large numbers correctly', () => {
      render(
        <RagStatsCards
          totalFiles={10000}
          pending={2500}
          completed={6000}
          failed={1500}
        />
      );

      expect(screen.getByText('10000')).toBeInTheDocument();
      expect(screen.getByText('2500')).toBeInTheDocument();
      expect(screen.getByText('6000')).toBeInTheDocument();
      expect(screen.getByText('1500')).toBeInTheDocument();
    });
  });
});
