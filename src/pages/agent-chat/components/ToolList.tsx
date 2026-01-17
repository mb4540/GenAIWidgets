import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Wrench, Trash2, Pencil, Server, Code, Zap, ZapOff, Link2, X } from 'lucide-react';
import type { AgentTool, Agent } from '@/types/agent';

interface ToolListProps {
  tools: AgentTool[];
  onEdit: (tool: AgentTool) => void;
  onDelete: (toolId: string) => Promise<void>;
}

export default function ToolList({
  tools,
  onEdit,
  onDelete,
}: ToolListProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [assigningTool, setAssigningTool] = useState<AgentTool | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assignedAgentIds, setAssignedAgentIds] = useState<Set<string>>(new Set());
  const [loadingAgents, setLoadingAgents] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const fetchAgentsAndAssignments = useCallback(async (toolId: string) => {
    setLoadingAgents(true);
    try {
      const [agentsRes, assignedRes] = await Promise.all([
        fetch('/api/agents', { headers: getAuthHeaders() }),
        fetch(`/api/agent-tools?action=assignments&toolId=${toolId}`, { headers: getAuthHeaders() }),
      ]);
      const agentsData = await agentsRes.json() as { success: boolean; agents?: Agent[] };
      const assignedData = await assignedRes.json() as { success: boolean; agents?: Array<{ agent_id: string }> };
      
      if (agentsData.success && agentsData.agents) {
        setAgents(agentsData.agents);
      }
      if (assignedData.success && assignedData.agents) {
        setAssignedAgentIds(new Set(assignedData.agents.map(a => a.agent_id)));
      }
    } catch {
      console.error('Failed to fetch agents');
    } finally {
      setLoadingAgents(false);
    }
  }, [getAuthHeaders]);

  const handleOpenAssign = (tool: AgentTool) => {
    setAssigningTool(tool);
    void fetchAgentsAndAssignments(tool.tool_id);
  };

  const handleToggleAssignment = async (agentId: string) => {
    if (!assigningTool) return;
    const isAssigned = assignedAgentIds.has(agentId);
    const method = isAssigned ? 'DELETE' : 'POST';
    
    try {
      const response = await fetch(
        `/api/agent-tools?action=assign&agentId=${agentId}&toolId=${assigningTool.tool_id}`,
        { method, headers: getAuthHeaders() }
      );
      if (response.ok) {
        setAssignedAgentIds(prev => {
          const next = new Set(prev);
          if (isAssigned) {
            next.delete(agentId);
          } else {
            next.add(agentId);
          }
          return next;
        });
      }
    } catch {
      console.error('Failed to toggle assignment');
    }
  };

  useEffect(() => {
    if (!assigningTool) {
      setAgents([]);
      setAssignedAgentIds(new Set());
    }
  }, [assigningTool]);

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
    );
  }, [tools, searchQuery]);

  const getToolTypeIcon = (toolType: string): React.ReactElement => {
    switch (toolType) {
      case 'mcp_server':
        return <Server className="h-4 w-4" />;
      case 'python_script':
        return <Code className="h-4 w-4" />;
      default:
        return <Wrench className="h-4 w-4" />;
    }
  };

  const getToolTypeBadgeColor = (toolType: string): string => {
    switch (toolType) {
      case 'mcp_server':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'python_script':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tools by name or description..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {filteredTools.length === 0 && tools.length > 0 && (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">
          No tools match your search
        </div>
      )}

      {tools.length === 0 && (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">
          <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No tools yet</p>
          <p>Create your first tool to extend agent capabilities</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTools.map((tool) => (
          <div
            key={tool.tool_id}
            className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                <h3 className="font-semibold truncate">{tool.name}</h3>
              </div>
              <div className="flex items-center gap-1" title={tool.is_active ? 'Active' : 'Inactive'}>
                {tool.is_active ? (
                  <Zap className="h-4 w-4 text-green-500" />
                ) : (
                  <ZapOff className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {tool.description}
            </p>

            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${getToolTypeBadgeColor(tool.tool_type)}`}>
                {getToolTypeIcon(tool.tool_type)}
                {tool.tool_type === 'mcp_server' ? 'MCP Server' : 'Python Script'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                {Object.keys(tool.input_schema).length > 0 
                  ? `${Object.keys(tool.input_schema).length} schema fields`
                  : 'No schema defined'}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenAssign(tool)}
                  className="p-1.5 text-muted-foreground hover:text-primary"
                  title="Assign to agents"
                >
                  <Link2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onEdit(tool)}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                  title="Edit tool"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => void onDelete(tool.tool_id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive"
                  title="Delete tool"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {assigningTool && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Assign "{assigningTool.name}" to Agents</h2>
              <button
                onClick={() => setAssigningTool(null)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {loadingAgents ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : agents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No agents available. Create an agent first.</p>
              ) : (
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <button
                      key={agent.agent_id}
                      onClick={() => void handleToggleAssignment(agent.agent_id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        assignedAgentIds.has(agent.agent_id)
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">{agent.model_provider} / {agent.model_name}</div>
                      </div>
                      {assignedAgentIds.has(agent.agent_id) && (
                        <div className="text-primary">
                          <Zap className="h-5 w-5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border">
              <button
                onClick={() => setAssigningTool(null)}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
