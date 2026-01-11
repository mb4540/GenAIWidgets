import React from 'react';
import RagInventoryRow, { type InventoryItem } from './RagInventoryRow';

interface RagInventoryTableProps {
  inventory: InventoryItem[];
  onRetry: (blobId: string) => void;
  onViewContent?: (item: InventoryItem) => void;
  onGenerateQA?: (item: InventoryItem) => void;
  onReviewQA?: (item: InventoryItem) => void;
  formatFileSize: (bytes: number | null) => string;
}

export default function RagInventoryTable({
  inventory,
  onRetry,
  onViewContent,
  onGenerateQA,
  onReviewQA,
  formatFileSize,
}: RagInventoryTableProps): React.ReactElement {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">File Name</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Type</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Size</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Discovered</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {inventory.map((item) => (
            <RagInventoryRow
              key={item.id}
              item={item}
              onRetry={onRetry}
              onViewContent={onViewContent}
              onGenerateQA={onGenerateQA}
              onReviewQA={onReviewQA}
              formatFileSize={formatFileSize}
            />
          ))}
          {inventory.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                No files in inventory
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
