import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Wrench, Plus, Info } from 'lucide-react';
import PageInfoModal, { type PageInfoContent } from '@/components/common/PageInfoModal';
import ToolList from './components/ToolList';
import ToolForm from './components/ToolForm';
import type { AgentTool, ToolInput } from '@/types/agent';

const toolsManagementInfo: PageInfoContent = {
  title: 'Tools Management',
  overview: `Create and manage tools that agents can use to extend their capabilities.

Key Features:
• Define tools with JSON Schema input specifications
• Configure MCP server connections for external tools
• Assign tools to specific agents
• Test tool connectivity and health`,
  tables: [
    {
      name: 'agent_tools',
      description: 'Tool registry with input schemas and configurations',
      columns: ['tool_id', 'tenant_id', 'name', 'description', 'tool_type', 'input_schema', 'is_active'],
      relationships: ['tenants (tenant_id)', 'users (user_id)'],
    },
    {
      name: 'mcp_servers',
      description: 'MCP server configurations for tool execution',
      columns: ['mcp_server_id', 'tool_id', 'server_name', 'server_url', 'auth_type', 'health_status'],
      relationships: ['agent_tools (tool_id)'],
    },
  ],
  apis: [
    { method: 'GET', path: '/api/agent-tools', description: 'List all tools for the current tenant' },
    { method: 'POST', path: '/api/agent-tools', description: 'Create a new tool' },
    { method: 'PUT', path: '/api/agent-tools?id={id}', description: 'Update an existing tool' },
    { method: 'DELETE', path: '/api/agent-tools?id={id}', description: 'Delete a tool' },
    { method: 'GET', path: '/api/mcp-servers', description: 'List all MCP servers' },
    { method: 'POST', path: '/api/mcp-servers?toolId={id}', description: 'Create MCP server for a tool' },
  ],
};

export default function ToolsManagementPage(): React.ReactElement {
  const { user } = useAuth();
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTool, setEditingTool] = useState<AgentTool | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const fetchTools = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetch('/api/agent-tools', { headers: getAuthHeaders() });
      const data = await response.json() as { success: boolean; tools?: AgentTool[]; error?: string };
      if (data.success && data.tools) {
        setTools(data.tools);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch tools');
      }
    } catch {
      setError('Failed to fetch tools');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    void fetchTools();
  }, [fetchTools]);

  const handleCreateTool = async (input: ToolInput): Promise<void> => {
    try {
      const response = await fetch('/api/agent-tools', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });
      const data = await response.json() as { success: boolean; tool?: AgentTool; error?: string };
      if (data.success && data.tool) {
        setTools((prev) => [...prev, data.tool!]);
        setShowCreate(false);
        setError(null);
      } else {
        setError(data.error || 'Failed to create tool');
      }
    } catch {
      setError('Failed to create tool');
    }
  };

  const handleUpdateTool = async (toolId: string, input: ToolInput): Promise<void> => {
    try {
      const response = await fetch(`/api/agent-tools?id=${toolId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });
      const data = await response.json() as { success: boolean; tool?: AgentTool; error?: string };
      if (data.success && data.tool) {
        setTools((prev) => prev.map((t) => (t.tool_id === toolId ? data.tool! : t)));
        setEditingTool(null);
        setError(null);
      } else {
        setError(data.error || 'Failed to update tool');
      }
    } catch {
      setError('Failed to update tool');
    }
  };

  const handleDeleteTool = async (toolId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this tool? This will also remove it from all agents.')) {
      return;
    }
    try {
      const response = await fetch(`/api/agent-tools?id=${toolId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        setTools((prev) => prev.filter((t) => t.tool_id !== toolId));
        setError(null);
      } else {
        setError(data.error || 'Failed to delete tool');
      }
    } catch {
      setError('Failed to delete tool');
    }
  };

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">Please log in to manage tools.</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wrench className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Tools Management</h1>
            <p className="text-muted-foreground">Create and configure agent tools</p>
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
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Tool
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
        <ToolList
          tools={tools}
          onEdit={setEditingTool}
          onDelete={handleDeleteTool}
        />
      )}

      {showCreate && (
        <ToolForm
          onSubmit={handleCreateTool}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {editingTool && (
        <ToolForm
          tool={editingTool}
          onSubmit={(input: ToolInput) => handleUpdateTool(editingTool.tool_id, input)}
          onCancel={() => setEditingTool(null)}
        />
      )}

      <PageInfoModal
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        content={toolsManagementInfo}
      />
    </div>
  );
}
