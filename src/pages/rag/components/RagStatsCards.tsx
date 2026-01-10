import React from 'react';

interface RagStatsCardsProps {
  totalFiles: number;
  pending: number;
  completed: number;
  failed: number;
}

export default function RagStatsCards({
  totalFiles,
  pending,
  completed,
  failed,
}: RagStatsCardsProps): React.ReactElement {
  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-card border border-border rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-foreground">{totalFiles}</div>
        <div className="text-sm text-muted-foreground">Total Files</div>
      </div>
      <div className="bg-card border border-border rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-yellow-600">{pending}</div>
        <div className="text-sm text-muted-foreground">Pending</div>
      </div>
      <div className="bg-card border border-border rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-green-600">{completed}</div>
        <div className="text-sm text-muted-foreground">Extracted</div>
      </div>
      <div className="bg-card border border-border rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-red-600">{failed}</div>
        <div className="text-sm text-muted-foreground">Failed</div>
      </div>
    </div>
  );
}
