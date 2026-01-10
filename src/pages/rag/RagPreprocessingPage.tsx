import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layers, RefreshCw, Loader2 } from 'lucide-react';
import {
  RagStatsCards,
  RagStatusFilter,
  RagInventoryTable,
  type InventoryItem,
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
        return;
      }
      if (triggerData.jobsCreated && triggerData.jobsCreated > 0) {
        await fetch('/api/extraction/worker', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ processNext: true }),
        });
      }
      void fetchInventory();
      void fetchStats();
    } catch {
      setError('Failed to process files');
    } finally {
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
      await fetch('/api/extraction/worker', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ processNext: true }),
      });
      void fetchInventory();
      void fetchStats();
    } catch {
      setError('Failed to retry extraction');
    }
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
          formatFileSize={formatFileSize}
        />
      )}
    </div>
  );
}
