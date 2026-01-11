import React from 'react';
import { Sparkles, Clock, Check, X, Loader2 } from 'lucide-react';

interface ExtractionStatusProps {
  status: 'pending' | 'processing' | 'extracted' | 'failed' | null | undefined;
  chunkCount: number | null | undefined;
  isExtracting: boolean;
  onExtract: () => void;
  onViewChunks?: () => void;
}

export default function ExtractionStatus({
  status,
  chunkCount,
  isExtracting,
  onExtract,
  onViewChunks,
}: ExtractionStatusProps): React.ReactElement {
  if (isExtracting) {
    return (
      <span className="p-2 text-blue-500">
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }

  if (status === 'extracted') {
    return (
      <button
        onClick={onViewChunks}
        className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-50 rounded hover:bg-green-100 transition-colors" 
        title={`${chunkCount || 0} chunks extracted - click to view`}
      >
        <Check className="h-3 w-3" />
        {chunkCount || 0} chunks
      </button>
    );
  }

  if (status === 'processing') {
    return (
      <span className="p-2 text-blue-500" title="Processing">
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span className="p-2 text-yellow-500" title="Pending extraction">
        <Clock className="h-4 w-4" />
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <button
        onClick={onExtract}
        className="p-2 text-red-500 hover:text-red-600"
        title="Extraction failed - click to retry"
      >
        <X className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={onExtract}
      className="p-2 text-muted-foreground hover:text-primary"
      title="Extract for RAG"
    >
      <Sparkles className="h-4 w-4" />
    </button>
  );
}
