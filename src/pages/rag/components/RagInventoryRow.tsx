import React from 'react';
import { Eye, RefreshCw, FileText, Clock, Check, X, Loader2 } from 'lucide-react';

interface InventoryItem {
  id: string;
  tenantId: string;
  sourceStore: string;
  blobKey: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
  discoveredAt: string;
  updatedAt: string;
}

interface RagInventoryRowProps {
  item: InventoryItem;
  onRetry: (blobId: string) => void;
  onViewContent?: (item: InventoryItem) => void;
  formatFileSize: (bytes: number | null) => string;
}

function getStatusBadge(status: string): React.ReactElement {
  switch (status) {
    case 'extracted':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-50 rounded">
          <Check className="h-3 w-3" /> Extracted
        </span>
      );
    case 'processing':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded">
          <Loader2 className="h-3 w-3 animate-spin" /> Processing
        </span>
      );
    case 'pending':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs text-yellow-600 bg-yellow-50 rounded">
          <Clock className="h-3 w-3" /> Pending
        </span>
      );
    case 'failed':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 rounded">
          <X className="h-3 w-3" /> Failed
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 text-xs text-gray-500 bg-gray-50 rounded">
          {status}
        </span>
      );
  }
}

export default function RagInventoryRow({
  item,
  onRetry,
  onViewContent,
  formatFileSize,
}: RagInventoryRowProps): React.ReactElement {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{item.fileName}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {item.mimeType || 'Unknown'}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formatFileSize(item.sizeBytes)}
      </td>
      <td className="px-4 py-3">
        {getStatusBadge(item.status)}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {new Date(item.discoveredAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {item.status === 'extracted' && onViewContent && (
            <button
              onClick={() => onViewContent(item)}
              className="p-2 text-muted-foreground hover:text-primary"
              title="View extracted content"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
          {(item.status === 'failed' || item.status === 'pending') && (
            <button
              onClick={() => onRetry(item.id)}
              className="p-2 text-muted-foreground hover:text-primary"
              title={item.status === 'failed' ? 'Retry' : 'Extract'}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export type { InventoryItem };
