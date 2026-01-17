import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Bot, Plus, Info, Wrench } from 'lucide-react';
import PageInfoModal, { type PageInfoContent } from '@/components/common/PageInfoModal';
import AgentList from './components/AgentList';
import AgentForm from './components/AgentForm';
import AgentDetailModal from './components/AgentDetailModal';
import type { Agent, AgentInput } from '@/types/agent';

const agentManagementInfo: PageInfoContent = {
  title: 'Agent Management',
  overview: `Create and manage AI agents that can use tools and maintain memory across conversations.

Key Features:
• Create agents with custom goals and system prompts
• Configure model provider and parameters (OpenAI, Anthropic, Gemini)
• Assign tools to agents for extended capabilities
• View agent details and statistics`,
  tables: [
    {
      name: 'agents',
      description: 'Agent definitions with goals, prompts, and model configuration',
      columns: ['agent_id', 'tenant_id', 'name', 'goal', 'system_prompt', 'model_provider', 'model_name', 'max_steps', 'temperature', 'is_active'],
      relationships: ['tenants (tenant_id)', 'users (user_id)'],
    },
  ],
  apis: [
    { method: 'GET', path: '/api/agents', description: 'List all agents for the current tenant' },
    { method: 'GET', path: '/api/agents?id={id}', description: 'Get a single agent by ID' },
    { method: 'POST', path: '/api/agents', description: 'Create a new agent' },
    { method: 'PUT', path: '/api/agents?id={id}', description: 'Update an existing agent' },
    { method: 'DELETE', path: '/api/agents?id={id}', description: 'Delete an agent' },
  ],
};

export default function AgentManagementPage(): React.ReactElement {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [viewingAgent, setViewingAgent] = useState<Agent | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const fetchAgents = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetch('/api/agents', { headers: getAuthHeaders() });
      const data = await response.json() as { success: boolean; agents?: Agent[]; error?: string };
      if (data.success && data.agents) {
        setAgents(data.agents);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch agents');
      }
    } catch {
      setError('Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const handleCreateAgent = async (input: AgentInput): Promise<void> => {
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });
      const data = await response.json() as { success: boolean; agent?: Agent; error?: string };
      if (data.success && data.agent) {
        setAgents((prev) => [...prev, data.agent!]);
        setShowCreate(false);
        setError(null);
      } else {
        setError(data.error || 'Failed to create agent');
      }
    } catch {
      setError('Failed to create agent');
    }
  };

  const handleUpdateAgent = async (agentId: string, input: AgentInput): Promise<void> => {
    try {
      const response = await fetch(`/api/agents?id=${agentId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });
      const data = await response.json() as { success: boolean; agent?: Agent; error?: string };
      if (data.success && data.agent) {
        setAgents((prev) => prev.map((a) => (a.agent_id === agentId ? data.agent! : a)));
        setEditingAgent(null);
        setError(null);
      } else {
        setError(data.error || 'Failed to update agent');
      }
    } catch {
      setError('Failed to update agent');
    }
  };

  const handleDeleteAgent = async (agentId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this agent? This will also delete all sessions and memories.')) {
      return;
    }
    try {
      const response = await fetch(`/api/agents?id=${agentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        setAgents((prev) => prev.filter((a) => a.agent_id !== agentId));
        setError(null);
      } else {
        setError(data.error || 'Failed to delete agent');
      }
    } catch {
      setError('Failed to delete agent');
    }
  };

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">Please log in to manage agents.</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Agent Management</h1>
            <p className="text-muted-foreground">Create and configure AI agents</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo(true)}
            className="p-2 text-muted-foreground hover:text-foreground"
            title="Page info"
          >
            <Info className="h-5 w-5" />
          </button>
          <Link
            to="/agent-chat/tools"
            className="flex items-center gap-2 bg-muted text-muted-foreground px-4 py-2 rounded-md text-sm hover:bg-muted/80"
          >
            <Wrench className="h-4 w-4" /> Manage Tools
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Agent
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <AgentList
          agents={agents}
          onEdit={setEditingAgent}
          onView={setViewingAgent}
          onDelete={handleDeleteAgent}
        />
      )}

      {showCreate && (
        <AgentForm
          onSubmit={handleCreateAgent}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {editingAgent && (
        <AgentForm
          agent={editingAgent}
          onSubmit={(input: AgentInput) => handleUpdateAgent(editingAgent.agent_id, input)}
          onCancel={() => setEditingAgent(null)}
        />
      )}

      {viewingAgent && (
        <AgentDetailModal
          agent={viewingAgent}
          onClose={() => setViewingAgent(null)}
          onEdit={() => {
            setViewingAgent(null);
            setEditingAgent(viewingAgent);
          }}
        />
      )}

      <PageInfoModal
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        content={agentManagementInfo}
      />
    </div>
  );
}
