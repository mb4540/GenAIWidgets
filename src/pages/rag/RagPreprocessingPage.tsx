import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layers, RefreshCw, Eye, Clock, Check, X, Loader2, FileText } from 'lucide-react';

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
      // Stats are optional, don't show error
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
        const workerResponse = await fetch('/api/extraction/worker', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ processNext: true }),
        });

        await workerResponse.json();
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

      const workerResponse = await fetch('/api/extraction/worker', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ processNext: true }),
      });

      await workerResponse.json();
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

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-foreground">{inventory.length}</div>
          <div className="text-sm text-muted-foreground">Total Files</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600">{stats.queued}</div>
          <div className="text-sm text-muted-foreground">Pending</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-muted-foreground">Extracted</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-sm text-muted-foreground">Failed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'pending', 'processing', 'extracted', 'failed'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1 text-sm rounded-md ${
              statusFilter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">File Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Size</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Discovered</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inventory.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
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
                      {item.status === 'extracted' && (
                        <button
                          className="p-2 text-muted-foreground hover:text-primary"
                          title="View chunks"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      {(item.status === 'failed' || item.status === 'pending') && (
                        <button
                          onClick={() => void handleRetry(item.id)}
                          className="p-2 text-muted-foreground hover:text-primary"
                          title={item.status === 'failed' ? 'Retry' : 'Extract'}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
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
      )}
    </div>
  );
}
