import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layers, RefreshCw, Loader2 } from 'lucide-react';
import {
  RagStatsCards,
  RagStatusFilter,
  RagInventoryTable,
  ExtractionPreviewModal,
  QAGenerateModal,
  QAReviewModal,
  type InventoryItem,
  type ExtractedContent,
} from './components';

interface JobStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
}

interface InventoryResponse {
  success: boolean;
  inventory: InventoryItem[];
  total: number;
  error?: string;
}

interface StatsResponse {
  success: boolean;
  summary: JobStats;
  error?: string;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RagPreprocessingPage(): React.ReactElement {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<JobStats>({ queued: 0, running: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [processingAll, setProcessingAll] = useState(false);
  
  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<ExtractedContent | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Q&A modal state
  const [qaGenerateOpen, setQaGenerateOpen] = useState(false);
  const [qaGenerateItem, setQaGenerateItem] = useState<InventoryItem | null>(null);
  const [qaGenerateLoading, setQaGenerateLoading] = useState(false);
  const [qaReviewOpen, setQaReviewOpen] = useState(false);
  const [qaReviewItem, setQaReviewItem] = useState<InventoryItem | null>(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const fetchInventory = useCallback(async (): Promise<void> => {
    try {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const response = await fetch(`/api/extraction/inventory?limit=100${statusParam}`, {
        headers: getAuthHeaders(),
      });
      const data = (await response.json()) as InventoryResponse;
      if (data.success) {
        setInventory(data.inventory);
      } else {
        setError(data.error || 'Failed to fetch inventory');
      }
    } catch {
      setError('Failed to fetch inventory');
    }
  }, [getAuthHeaders, statusFilter]);

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/extraction/jobs?stats=true', {
        headers: getAuthHeaders(),
      });
      const data = (await response.json()) as StatsResponse;
      if (data.success) {
        setStats(data.summary);
      }
    } catch {
      // Stats are optional
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      await Promise.all([fetchInventory(), fetchStats()]);
      setLoading(false);
    };
    void loadData();
  }, [fetchInventory, fetchStats]);

  const handleProcessAll = async (): Promise<void> => {
    setProcessingAll(true);
    try {
      const triggerResponse = await fetch('/api/extraction/trigger', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ processAll: true }),
      });
      const triggerData = (await triggerResponse.json()) as { success: boolean; jobsCreated?: number; error?: string };
      if (!triggerData.success) {
        setError(triggerData.error || 'Failed to trigger extraction');
        setProcessingAll(false);
        return;
      }
      
      // Background processing started - poll for updates
      void fetchInventory();
      void fetchStats();
      
      // Poll every 5 seconds while processing
      const pollInterval = setInterval(async () => {
        await fetchInventory();
        await fetchStats();
        const stillProcessing = inventory.some(i => i.status === 'processing');
        if (!stillProcessing) {
          clearInterval(pollInterval);
          setProcessingAll(false);
        }
      }, 5000);
      
      // Stop polling after 10 minutes max
      setTimeout(() => {
        clearInterval(pollInterval);
        setProcessingAll(false);
      }, 10 * 60 * 1000);
      
    } catch {
      setError('Failed to process files');
      setProcessingAll(false);
    }
  };

  const handleRetry = async (blobId: string): Promise<void> => {
    try {
      const triggerResponse = await fetch('/api/extraction/trigger', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ blobId }),
      });
      const triggerData = (await triggerResponse.json()) as { success: boolean; error?: string };
      if (!triggerData.success) {
        setError(triggerData.error || 'Failed to trigger extraction');
        return;
      }
      
      // Background processing started - refresh after a delay
      void fetchInventory();
      void fetchStats();
      
      // Poll for this specific item
      const pollInterval = setInterval(async () => {
        await fetchInventory();
        await fetchStats();
        const item = inventory.find(i => i.id === blobId);
        if (item?.status === 'extracted' || item?.status === 'failed') {
          clearInterval(pollInterval);
        }
      }, 3000);
      
      setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
      
    } catch {
      setError('Failed to retry extraction');
    }
  };

  const handleViewContent = async (item: InventoryItem): Promise<void> => {
    setPreviewLoading(true);
    setPreviewFileName(item.fileName);
    try {
      const response = await fetch(`/api/extraction/content?blobId=${item.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; content?: ExtractedContent; error?: string };
      if (data.success && data.content) {
        setPreviewContent(data.content);
        setPreviewOpen(true);
      } else {
        setError(data.error || 'Failed to load extracted content');
      }
    } catch {
      setError('Failed to load extracted content');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAcceptContent = (_content: string): void => {
    // For now, just close the modal
    // In the future, this could save edited content back
    setPreviewOpen(false);
    setPreviewContent(null);
  };

  const handleOpenGenerateQA = (item: InventoryItem): void => {
    setQaGenerateItem(item);
    setQaGenerateOpen(true);
  };

  const handleGenerateQA = async (questionsPerChunk: number): Promise<void> => {
    if (!qaGenerateItem) return;
    
    setQaGenerateLoading(true);
    try {
      const response = await fetch('/api/qa-generate-background', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          blobId: qaGenerateItem.id,
          questionsPerChunk,
        }),
      });
      
      // Background functions return 202 Accepted with empty body
      // or 200 with JSON response when complete
      if (response.status === 202 || response.ok) {
        // Try to parse JSON if available
        const text = await response.text();
        if (text) {
          const data = JSON.parse(text) as { success: boolean; error?: string };
          if (!data.success) {
            setError(data.error || 'Failed to generate Q&A pairs');
            return;
          }
        }
        setQaGenerateOpen(false);
        setQaGenerateItem(null);
        // Open review modal after generation
        setQaReviewItem(qaGenerateItem);
        setQaReviewOpen(true);
      } else {
        const text = await response.text();
        try {
          const data = JSON.parse(text) as { error?: string };
          setError(data.error || 'Failed to generate Q&A pairs');
        } catch {
          setError('Failed to generate Q&A pairs');
        }
      }
    } catch {
      setError('Failed to generate Q&A pairs');
    } finally {
      setQaGenerateLoading(false);
    }
  };

  const handleOpenReviewQA = (item: InventoryItem): void => {
    setQaReviewItem(item);
    setQaReviewOpen(true);
  };

  const pendingCount = inventory.filter(i => i.status === 'pending').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6" />
            RAG Preprocessing
          </h1>
          <p className="text-muted-foreground">Manage extracted files and chunks for retrieval</p>
        </div>
        {user?.isAdmin && pendingCount > 0 && (
          <button
            onClick={() => void handleProcessAll()}
            disabled={processingAll}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {processingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Process All Pending ({pendingCount})
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-destructive flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-sm underline">Dismiss</button>
        </div>
      )}

      <RagStatsCards
        totalFiles={inventory.length}
        pending={stats.queued}
        completed={stats.completed}
        failed={stats.failed}
      />

      <RagStatusFilter
        currentFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <RagInventoryTable
          inventory={inventory}
          onRetry={(id) => void handleRetry(id)}
          onViewContent={(item) => void handleViewContent(item)}
          onGenerateQA={handleOpenGenerateQA}
          onReviewQA={handleOpenReviewQA}
          formatFileSize={formatFileSize}
        />
      )}

      {/* Extraction Preview Modal */}
      <ExtractionPreviewModal
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewContent(null);
        }}
        onAccept={handleAcceptContent}
        extractedContent={previewContent}
        fileName={previewFileName}
      />

      {/* Loading overlay for preview */}
      {previewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-card p-4 rounded-lg flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading extracted content...</span>
          </div>
        </div>
      )}

      {/* Q&A Generate Modal */}
      <QAGenerateModal
        isOpen={qaGenerateOpen}
        onClose={() => {
          setQaGenerateOpen(false);
          setQaGenerateItem(null);
        }}
        onGenerate={handleGenerateQA}
        fileName={qaGenerateItem?.fileName || ''}
        chunkCount={qaGenerateItem?.chunkCount || 1}
        loading={qaGenerateLoading}
      />

      {/* Q&A Review Modal */}
      {qaReviewItem && (
        <QAReviewModal
          isOpen={qaReviewOpen}
          onClose={() => {
            setQaReviewOpen(false);
            setQaReviewItem(null);
          }}
          fileId={qaReviewItem.id}
          fileName={qaReviewItem.fileName}
        />
      )}
    </div>
  );
}
