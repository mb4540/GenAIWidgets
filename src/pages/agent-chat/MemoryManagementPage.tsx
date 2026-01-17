import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Brain, Plus, Trash2, Pencil, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Agent, AgentMemory, MemoryInput, MemoryType } from '@/types/agent';

const MEMORY_TYPES: { value: MemoryType; label: string; color: string }[] = [
  { value: 'fact', label: 'Fact', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'preference', label: 'Preference', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'learned', label: 'Learned', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  { value: 'user_provided', label: 'User Provided', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
];

export default function MemoryManagementPage(): React.ReactElement {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get('agentId');

  const [agent, setAgent] = useState<Agent | null>(null);
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMemory, setEditingMemory] = useState<AgentMemory | null>(null);
  const [filterType, setFilterType] = useState<MemoryType | 'all'>('all');

  // Form state
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState<MemoryType>('user_provided');
  const [formImportance, setFormImportance] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const fetchAgent = useCallback(async (): Promise<void> => {
    if (!agentId) return;
    try {
      const response = await fetch(`/api/agents?id=${agentId}`, { headers: getAuthHeaders() });
      const data = await response.json() as { success: boolean; agent?: Agent; error?: string };
      if (data.success && data.agent) {
        setAgent(data.agent);
      }
    } catch {
      setError('Failed to fetch agent');
    }
  }, [agentId, getAuthHeaders]);

  const fetchMemories = useCallback(async (): Promise<void> => {
    if (!agentId) return;
    try {
      setLoading(true);
      const url = filterType === 'all' 
        ? `/api/agent-memories?agentId=${agentId}`
        : `/api/agent-memories?agentId=${agentId}&type=${filterType}`;
      const response = await fetch(url, { headers: getAuthHeaders() });
      const data = await response.json() as { success: boolean; memories?: AgentMemory[]; error?: string };
      if (data.success && data.memories) {
        setMemories(data.memories);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch memories');
      }
    } catch {
      setError('Failed to fetch memories');
    } finally {
      setLoading(false);
    }
  }, [agentId, filterType, getAuthHeaders]);

  useEffect(() => {
    void fetchAgent();
    void fetchMemories();
  }, [fetchAgent, fetchMemories]);

  const resetForm = () => {
    setFormContent('');
    setFormType('user_provided');
    setFormImportance(5);
    setEditingMemory(null);
    setShowForm(false);
  };

  const openEditForm = (memory: AgentMemory) => {
    setEditingMemory(memory);
    setFormContent(memory.content);
    setFormType(memory.memory_type);
    setFormImportance(memory.importance);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!formContent.trim() || !agentId) return;

    setSubmitting(true);
    setError(null);

    const input: MemoryInput = {
      content: formContent.trim(),
      memory_type: formType,
      importance: formImportance,
      is_active: true,
    };

    try {
      if (editingMemory) {
        // Update
        const response = await fetch(`/api/agent-memories?id=${editingMemory.memory_id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(input),
        });
        const data = await response.json() as { success: boolean; memory?: AgentMemory; error?: string };
        if (data.success && data.memory) {
          setMemories((prev) => prev.map((m) => m.memory_id === editingMemory.memory_id ? data.memory! : m));
          resetForm();
        } else {
          setError(data.error || 'Failed to update memory');
        }
      } else {
        // Create
        const response = await fetch(`/api/agent-memories?agentId=${agentId}`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(input),
        });
        const data = await response.json() as { success: boolean; memory?: AgentMemory; error?: string };
        if (data.success && data.memory) {
          setMemories((prev) => [data.memory!, ...prev]);
          resetForm();
        } else {
          setError(data.error || 'Failed to create memory');
        }
      }
    } catch {
      setError('Failed to save memory');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (memoryId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this memory?')) return;

    try {
      const response = await fetch(`/api/agent-memories?id=${memoryId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        setMemories((prev) => prev.filter((m) => m.memory_id !== memoryId));
      } else {
        setError(data.error || 'Failed to delete memory');
      }
    } catch {
      setError('Failed to delete memory');
    }
  };

  const getTypeColor = (type: MemoryType): string => {
    return MEMORY_TYPES.find((t) => t.value === type)?.color || 'bg-gray-100 text-gray-800';
  };

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">Please log in to manage memories.</div>;
  }

  if (!agentId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No agent selected</p>
        <p>Select an agent to manage its memories.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/agent-chat" className="p-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Brain className="h-8 w-8 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Memory Management</h1>
          <p className="text-muted-foreground">{agent?.name || 'Agent'} - Long-term memories</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Memory
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1 rounded-full text-sm ${filterType === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
        >
          All
        </button>
        {MEMORY_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => setFilterType(type.value)}
            className={`px-3 py-1 rounded-full text-sm ${filterType === type.value ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Memory Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-lg">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold">{editingMemory ? 'Edit Memory' : 'Add Memory'}</h2>
            </div>
            <form onSubmit={(e) => void handleSubmit(e)} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Content *</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Enter the memory content..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as MemoryType)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {MEMORY_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Importance: {formImportance}</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formImportance}
                    onChange={(e) => setFormImportance(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
                  disabled={submitting || !formContent.trim()}
                >
                  {submitting ? 'Saving...' : editingMemory ? 'Update' : 'Add Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Memories List */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : memories.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">
          <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No memories yet</p>
          <p>Add memories to help the agent remember important information.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => (
            <div key={memory.memory_id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(memory.memory_type)}`}>
                      {MEMORY_TYPES.find((t) => t.value === memory.memory_type)?.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Importance: {memory.importance}/10
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Accessed: {memory.access_count}x
                    </span>
                  </div>
                  <p className="text-sm">{memory.content}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditForm(memory)}
                    className="p-1.5 text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void handleDelete(memory.memory_id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
