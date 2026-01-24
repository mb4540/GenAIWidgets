import React, { useState, useEffect, useCallback } from 'react';
import { Database, RefreshCw, Loader2, Trash2, Eye, Edit, Plus, X } from 'lucide-react';

interface BlobEntry {
  key: string;
  size?: number;
}

interface BlobContent {
  key: string;
  content: unknown;
  isJson: boolean;
  size: number;
}

const BLOB_STORES = [
  { id: 'user-files', name: 'User Files', description: 'User uploaded files' },
  { id: 'ai-chats-jobs', name: 'AI Chat Jobs', description: 'AI chat job data' },
  { id: 'extracted-chunks', name: 'Extracted Chunks', description: 'RAG extraction chunks' },
];

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function BlobStorageTab(): React.ReactElement {
  const [selectedStore, setSelectedStore] = useState(BLOB_STORES[0]!.id);
  const [blobs, setBlobs] = useState<BlobEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [viewingBlob, setViewingBlob] = useState<BlobContent | null>(null);
  const [editingBlob, setEditingBlob] = useState<BlobContent | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBlobKey, setNewBlobKey] = useState('');
  const [newBlobContent, setNewBlobContent] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const fetchBlobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/blobs?store=${selectedStore}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; blobs?: BlobEntry[]; error?: string };
      if (data.success && data.blobs) {
        setBlobs(data.blobs);
      } else {
        setError(data.error || 'Failed to fetch blobs');
      }
    } catch {
      setError('Failed to fetch blobs');
    } finally {
      setLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    void fetchBlobs();
  }, [fetchBlobs]);

  const handleViewBlob = async (key: string) => {
    setModalLoading(true);
    try {
      const response = await fetch(`/api/admin/blobs?store=${selectedStore}&key=${encodeURIComponent(key)}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; error?: string } & BlobContent;
      if (data.success) {
        setViewingBlob({
          key: data.key,
          content: data.content,
          isJson: data.isJson,
          size: data.size,
        });
      } else {
        setError(data.error || 'Failed to fetch blob');
      }
    } catch {
      setError('Failed to fetch blob');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditBlob = async (key: string) => {
    setModalLoading(true);
    try {
      const response = await fetch(`/api/admin/blobs?store=${selectedStore}&key=${encodeURIComponent(key)}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; error?: string } & BlobContent;
      if (data.success) {
        setEditingBlob({
          key: data.key,
          content: data.content,
          isJson: data.isJson,
          size: data.size,
        });
        setEditContent(
          data.isJson ? JSON.stringify(data.content, null, 2) : String(data.content)
        );
      } else {
        setError(data.error || 'Failed to fetch blob');
      }
    } catch {
      setError('Failed to fetch blob');
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingBlob) return;
    setModalLoading(true);
    try {
      let content: unknown = editContent;
      // Try to parse as JSON
      try {
        content = JSON.parse(editContent);
      } catch {
        // Keep as string
      }

      const response = await fetch(`/api/admin/blobs?store=${selectedStore}&key=${encodeURIComponent(editingBlob.key)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        setEditingBlob(null);
        void fetchBlobs();
      } else {
        setError(data.error || 'Failed to update blob');
      }
    } catch {
      setError('Failed to update blob');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteBlob = async (key: string) => {
    if (!confirm(`Are you sure you want to delete "${key}"?`)) return;
    
    try {
      const response = await fetch(`/api/admin/blobs?store=${selectedStore}&key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        void fetchBlobs();
      } else {
        setError(data.error || 'Failed to delete blob');
      }
    } catch {
      setError('Failed to delete blob');
    }
  };

  const handleCreateBlob = async () => {
    if (!newBlobKey.trim()) {
      setError('Key is required');
      return;
    }
    setModalLoading(true);
    try {
      let content: unknown = newBlobContent;
      // Try to parse as JSON
      try {
        content = JSON.parse(newBlobContent);
      } catch {
        // Keep as string
      }

      const response = await fetch(`/api/admin/blobs?store=${selectedStore}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ key: newBlobKey.trim(), content }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        setShowCreateModal(false);
        setNewBlobKey('');
        setNewBlobContent('');
        void fetchBlobs();
      } else {
        setError(data.error || 'Failed to create blob');
      }
    } catch {
      setError('Failed to create blob');
    } finally {
      setModalLoading(false);
    }
  };

  const formatContent = (content: unknown, isJson: boolean): string => {
    if (isJson) {
      return JSON.stringify(content, null, 2);
    }
    return String(content);
  };

  return (
    <div className="space-y-4">
      {/* Store Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {BLOB_STORES.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-muted-foreground flex-1">
          {BLOB_STORES.find(s => s.id === selectedStore)?.description}
        </p>
        <button
          onClick={() => void fetchBlobs()}
          disabled={loading}
          className="p-2 hover:bg-accent rounded-md"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Blob
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="p-1 hover:bg-destructive/20 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Blobs Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : blobs.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">
          <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No blobs found</p>
          <p>This store is empty</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium">Key</th>
                <th className="text-right px-4 py-3 text-sm font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {blobs.map((blob) => (
                <tr key={blob.key} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm font-mono truncate max-w-md">
                    {blob.key}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => void handleViewBlob(blob.key)}
                        className="p-1.5 text-muted-foreground hover:text-foreground"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => void handleEditBlob(blob.key)}
                        className="p-1.5 text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => void handleDeleteBlob(blob.key)}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Modal */}
      {viewingBlob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-3xl max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">View Blob</h2>
              <button onClick={() => setViewingBlob(null)} className="p-1 hover:bg-accent rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-2 font-mono">{viewingBlob.key}</p>
            <p className="text-xs text-muted-foreground mb-4">
              Size: {viewingBlob.size} bytes | Type: {viewingBlob.isJson ? 'JSON' : 'Text'}
            </p>
            <pre className="flex-1 overflow-auto bg-muted p-4 rounded-md text-sm font-mono whitespace-pre-wrap">
              {formatContent(viewingBlob.content, viewingBlob.isJson)}
            </pre>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingBlob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-3xl max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Blob</h2>
              <button onClick={() => setEditingBlob(null)} className="p-1 hover:bg-accent rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4 font-mono">{editingBlob.key}</p>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 min-h-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditingBlob(null)}
                className="px-4 py-2 text-sm rounded-md hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveEdit()}
                disabled={modalLoading}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-3xl max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create New Blob</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-accent rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Key</label>
              <input
                type="text"
                value={newBlobKey}
                onChange={(e) => setNewBlobKey(e.target.value)}
                placeholder="Enter blob key..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Content</label>
              <textarea
                value={newBlobContent}
                onChange={(e) => setNewBlobContent(e.target.value)}
                placeholder="Enter content (JSON or text)..."
                className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm rounded-md hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateBlob()}
                disabled={modalLoading || !newBlobKey.trim()}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
