import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Edit2, Trash2, Loader2, CheckCheck, Filter } from 'lucide-react';

interface QAPair {
  qaId: string;
  chunkIndex: number;
  chunkText: string | null;
  question: string;
  answer: string;
  status: 'pending' | 'approved' | 'rejected';
  generatedBy: string | null;
  createdAt: string;
}

interface QAStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface QAReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  blobId: string;
  fileName: string;
}

interface QAListResponse {
  success: boolean;
  qaPairs: QAPair[];
  stats: QAStats;
  error?: string;
}

export default function QAReviewModal({
  isOpen,
  onClose,
  blobId,
  fileName,
}: QAReviewModalProps): React.ReactElement | null {
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
  const [stats, setStats] = useState<QAStats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const fetchQAPairs = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const response = await fetch(`/api/qa/list?blobId=${blobId}${statusParam}`, {
        headers: getAuthHeaders(),
      });
      const data = (await response.json()) as QAListResponse;
      if (data.success) {
        setQaPairs(data.qaPairs);
        setStats(data.stats);
      } else {
        setError(data.error || 'Failed to fetch Q&A pairs');
      }
    } catch {
      setError('Failed to fetch Q&A pairs');
    } finally {
      setLoading(false);
    }
  }, [blobId, statusFilter, getAuthHeaders]);

  useEffect(() => {
    if (isOpen) {
      void fetchQAPairs();
    }
  }, [isOpen, fetchQAPairs]);

  const handleApprove = async (qaId: string): Promise<void> => {
    setActionLoading(qaId);
    try {
      const response = await fetch('/api/qa/update', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ qaId, status: 'approved' }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) {
        setQaPairs(prev => prev.map(qa => 
          qa.qaId === qaId ? { ...qa, status: 'approved' as const } : qa
        ));
        setStats(prev => ({
          ...prev,
          pending: prev.pending - 1,
          approved: prev.approved + 1,
        }));
      } else {
        setError(data.error || 'Failed to approve');
      }
    } catch {
      setError('Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (qaId: string): Promise<void> => {
    setActionLoading(qaId);
    try {
      const response = await fetch('/api/qa/update', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ qaId, status: 'rejected' }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) {
        setQaPairs(prev => prev.map(qa => 
          qa.qaId === qaId ? { ...qa, status: 'rejected' as const } : qa
        ));
        setStats(prev => ({
          ...prev,
          pending: prev.pending - 1,
          rejected: prev.rejected + 1,
        }));
      } else {
        setError(data.error || 'Failed to reject');
      }
    } catch {
      setError('Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (qaId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this Q&A pair?')) return;
    
    setActionLoading(qaId);
    try {
      const response = await fetch(`/api/qa/delete?qaId=${qaId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) {
        const deletedQA = qaPairs.find(qa => qa.qaId === qaId);
        setQaPairs(prev => prev.filter(qa => qa.qaId !== qaId));
        if (deletedQA) {
          setStats(prev => ({
            ...prev,
            total: prev.total - 1,
            [deletedQA.status]: prev[deletedQA.status as keyof QAStats] as number - 1,
          }));
        }
      } else {
        setError(data.error || 'Failed to delete');
      }
    } catch {
      setError('Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEdit = (qa: QAPair): void => {
    setEditingId(qa.qaId);
    setEditQuestion(qa.question);
    setEditAnswer(qa.answer);
  };

  const handleSaveEdit = async (): Promise<void> => {
    if (!editingId) return;
    
    setActionLoading(editingId);
    try {
      const response = await fetch('/api/qa/update', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          qaId: editingId,
          question: editQuestion,
          answer: editAnswer,
        }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) {
        setQaPairs(prev => prev.map(qa => 
          qa.qaId === editingId ? { ...qa, question: editQuestion, answer: editAnswer } : qa
        ));
        setEditingId(null);
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Failed to save');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAll = async (): Promise<void> => {
    if (!confirm(`Approve all ${stats.pending} pending Q&A pairs?`)) return;
    
    setActionLoading('bulk');
    try {
      const response = await fetch('/api/qa/bulk-approve', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ blobId, approveAll: true }),
      });
      const data = (await response.json()) as { success: boolean; approvedCount?: number; error?: string };
      if (data.success) {
        void fetchQAPairs();
      } else {
        setError(data.error || 'Failed to approve all');
      }
    } catch {
      setError('Failed to approve all');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  // Group Q&A pairs by chunk
  const groupedByChunk = qaPairs.reduce((acc, qa) => {
    const key = qa.chunkIndex;
    if (!acc[key]) {
      acc[key] = { chunkText: qa.chunkText, pairs: [] };
    }
    acc[key].pairs.push(qa);
    return acc;
  }, {} as Record<number, { chunkText: string | null; pairs: QAPair[] }>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Review Q&A Pairs</h2>
            <p className="text-sm text-muted-foreground">{fileName}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-border rounded px-2 py-1 bg-background"
              >
                <option value="all">All ({stats.total})</option>
                <option value="pending">Pending ({stats.pending})</option>
                <option value="approved">Approved ({stats.approved})</option>
                <option value="rejected">Rejected ({stats.rejected})</option>
              </select>
            </div>
          </div>
          
          {stats.pending > 0 && (
            <button
              onClick={() => void handleApproveAll()}
              disabled={actionLoading === 'bulk'}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading === 'bulk' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              Approve All Pending
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-destructive text-sm flex justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="underline">Dismiss</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : qaPairs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No Q&A pairs found. Generate some first!
            </div>
          ) : (
            Object.entries(groupedByChunk).map(([chunkIndex, { chunkText, pairs }]) => (
              <div key={chunkIndex} className="space-y-3">
                <div className="bg-muted/50 p-3 rounded-md border border-border">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Chunk {chunkIndex}
                  </div>
                  <div className="text-sm line-clamp-3">
                    {chunkText || 'No chunk text available'}
                  </div>
                </div>

                {pairs.map((qa) => (
                  <div
                    key={qa.qaId}
                    className={`ml-4 p-3 rounded-md border ${
                      qa.status === 'approved'
                        ? 'border-green-500/50 bg-green-50 dark:bg-green-900/20'
                        : qa.status === 'rejected'
                        ? 'border-red-500/50 bg-red-50 dark:bg-red-900/20'
                        : 'border-border bg-background'
                    }`}
                  >
                    {editingId === qa.qaId ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Question</label>
                          <textarea
                            value={editQuestion}
                            onChange={(e) => setEditQuestion(e.target.value)}
                            rows={2}
                            className="w-full mt-1 p-2 text-sm border border-border rounded bg-background"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Answer</label>
                          <textarea
                            value={editAnswer}
                            onChange={(e) => setEditAnswer(e.target.value)}
                            rows={3}
                            className="w-full mt-1 p-2 text-sm border border-border rounded bg-background"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleSaveEdit()}
                            disabled={actionLoading === qa.qaId}
                            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                          >
                            {actionLoading === qa.qaId ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 text-sm border border-border rounded hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-2">
                          <div className="text-xs font-medium text-muted-foreground">Q:</div>
                          <div className="text-sm">{qa.question}</div>
                        </div>
                        <div className="mb-3">
                          <div className="text-xs font-medium text-muted-foreground">A:</div>
                          <div className="text-sm">{qa.answer}</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            qa.status === 'approved'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : qa.status === 'rejected'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          }`}>
                            {qa.status}
                          </span>
                          <div className="flex items-center gap-1">
                            {qa.status === 'pending' && (
                              <button
                                onClick={() => void handleApprove(qa.qaId)}
                                disabled={actionLoading === qa.qaId}
                                className="p-1.5 text-green-600 hover:bg-green-100 rounded disabled:opacity-50"
                                title="Approve"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(qa)}
                              disabled={actionLoading === qa.qaId}
                              className="p-1.5 text-muted-foreground hover:bg-muted rounded disabled:opacity-50"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {qa.status === 'pending' && (
                              <button
                                onClick={() => void handleReject(qa.qaId)}
                                disabled={actionLoading === qa.qaId}
                                className="p-1.5 text-red-600 hover:bg-red-100 rounded disabled:opacity-50"
                                title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => void handleDelete(qa.qaId)}
                              disabled={actionLoading === qa.qaId}
                              className="p-1.5 text-muted-foreground hover:bg-muted rounded disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-end p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export type { QAReviewModalProps, QAPair, QAStats };
