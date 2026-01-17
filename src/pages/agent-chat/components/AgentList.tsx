import React, { useState, useMemo } from 'react';
import { Bot, Trash2, Pencil, Eye, Zap, ZapOff, MessageSquare, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Agent } from '@/types/agent';

interface AgentListProps {
  agents: Agent[];
  onEdit: (agent: Agent) => void;
  onView: (agent: Agent) => void;
  onDelete: (agentId: string) => Promise<void>;
}

export default function AgentList({
  agents,
  onEdit,
  onView,
  onDelete,
}: AgentListProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query) ||
        a.goal.toLowerCase().includes(query)
    );
  }, [agents, searchQuery]);

  const getProviderBadgeColor = (provider: string): string => {
    switch (provider) {
      case 'openai':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'anthropic':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'gemini':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
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
          placeholder="Search agents by name, description, or goal..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {filteredAgents.length === 0 && agents.length > 0 && (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">
          No agents match your search
        </div>
      )}

      {agents.length === 0 && (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No agents yet</p>
          <p>Create your first agent to get started</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAgents.map((agent) => (
          <div
            key={agent.agent_id}
            className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <h3 className="font-semibold truncate">{agent.name}</h3>
              </div>
              <div className="flex items-center gap-1" title={agent.is_active ? 'Active' : 'Inactive'}>
                {agent.is_active ? (
                  <Zap className="h-4 w-4 text-green-500" />
                ) : (
                  <ZapOff className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {agent.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {agent.description}
              </p>
            )}

            <div className="text-sm text-muted-foreground mb-3">
              <span className="font-medium">Goal:</span>{' '}
              <span className="line-clamp-1">{agent.goal}</span>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2 py-1 rounded-full ${getProviderBadgeColor(agent.model_provider)}`}>
                {agent.model_provider}
              </span>
              <span className="text-xs text-muted-foreground">
                {agent.model_name}
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Link
                  to={`/agent-chat/chat?agentId=${agent.agent_id}`}
                  className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                >
                  <MessageSquare className="h-3 w-3" /> Chat
                </Link>
                <Link
                  to={`/agent-chat/memories?agentId=${agent.agent_id}`}
                  className="flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground rounded text-xs hover:bg-muted/80"
                >
                  <Brain className="h-3 w-3" /> Memories
                </Link>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onView(agent)}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                  title="View details"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onEdit(agent)}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                  title="Edit agent"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => void onDelete(agent.agent_id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive"
                  title="Delete agent"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
