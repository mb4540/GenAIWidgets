import React from 'react';

interface RagStatusFilterProps {
  currentFilter: string;
  onFilterChange: (filter: string) => void;
}

const STATUSES = ['all', 'pending', 'processing', 'extracted', 'failed'];

export default function RagStatusFilter({
  currentFilter,
  onFilterChange,
}: RagStatusFilterProps): React.ReactElement {
  return (
    <div className="flex gap-2">
      {STATUSES.map((status) => (
        <button
          key={status}
          onClick={() => onFilterChange(status)}
          className={`px-3 py-1 text-sm rounded-md ${
            currentFilter === status
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </button>
      ))}
    </div>
  );
}
