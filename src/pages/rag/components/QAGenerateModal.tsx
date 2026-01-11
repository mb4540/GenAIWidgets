import React, { useState } from 'react';
import { X, Sparkles, Loader2, AlertTriangle } from 'lucide-react';

interface QAGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (questionsPerChunk: number) => Promise<void>;
  fileName: string;
  chunkCount: number;
  loading?: boolean;
}

export default function QAGenerateModal({
  isOpen,
  onClose,
  onGenerate,
  fileName,
  chunkCount,
  loading = false,
}: QAGenerateModalProps): React.ReactElement | null {
  const [questionsPerChunk, setQuestionsPerChunk] = useState(3);

  if (!isOpen) return null;

  const totalQA = chunkCount * questionsPerChunk;
  const estimatedTime = Math.ceil(chunkCount * 2.5);

  const handleGenerate = (): void => {
    void onGenerate(questionsPerChunk);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-md m-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Generate Q&A Truth Set</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 hover:bg-muted rounded disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-muted/50 p-3 rounded-md space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Document:</span>
              <span className="ml-2 font-medium">{fileName}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Chunks:</span>
              <span className="ml-2 font-medium">{chunkCount}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Questions per chunk
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="10"
                value={questionsPerChunk}
                onChange={(e) => setQuestionsPerChunk(parseInt(e.target.value, 10))}
                disabled={loading}
                className="flex-1"
              />
              <span className="w-8 text-center font-medium">{questionsPerChunk}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>10</span>
            </div>
          </div>

          <div className="bg-muted/50 p-3 rounded-md text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Q&A pairs to generate:</span>
              <span className="font-medium">{totalQA}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-md border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p>This will call the LLM {chunkCount} times.</p>
              <p className="text-muted-foreground">Estimated time: ~{estimatedTime} seconds</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Q&A
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { QAGenerateModalProps };
