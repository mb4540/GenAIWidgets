import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, MessageSquare, Bot, Loader2 } from 'lucide-react';
import type { Agent, AgentSession } from '@/types/agent';

interface ChatHistorySidebarProps {
  selectedSessionId: string | null;
  onSessionSelect: (session: AgentSession, agent: Agent) => void;
  onNewChat: (agent: Agent) => void;
}

interface AgentWithSessions extends Agent {
  sessions?: AgentSession[];
  sessionsLoading?: boolean;
  expanded?: boolean;
}

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  selectedSessionId,
  onSessionSelect,
  onNewChat,
}) => {
  const [agents, setAgents] = useState<AgentWithSessions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/agents', { headers: getAuthHeaders() });
      const data = await response.json() as { success: boolean; agents?: Agent[]; error?: string };
      if (data.success && data.agents) {
        setAgents(data.agents.map(a => ({ ...a, expanded: false, sessions: undefined })));
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch agents');
      }
    } catch {
      setError('Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSessions = useCallback(async (agentId: string) => {
    setAgents(prev => prev.map(a => 
      a.agent_id === agentId ? { ...a, sessionsLoading: true } : a
    ));

    try {
      const response = await fetch(`/api/agent-sessions?agentId=${agentId}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; sessions?: AgentSession[]; error?: string };
      
      if (data.success && data.sessions) {
        setAgents(prev => prev.map(a => 
          a.agent_id === agentId 
            ? { ...a, sessions: data.sessions, sessionsLoading: false }
            : a
        ));
      } else {
        setAgents(prev => prev.map(a => 
          a.agent_id === agentId 
            ? { ...a, sessions: [], sessionsLoading: false }
            : a
        ));
      }
    } catch {
      setAgents(prev => prev.map(a => 
        a.agent_id === agentId 
          ? { ...a, sessions: [], sessionsLoading: false }
          : a
      ));
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const toggleAgent = (agentId: string) => {
    const agent = agents.find(a => a.agent_id === agentId);
    if (!agent) return;

    if (!agent.expanded && agent.sessions === undefined) {
      void fetchSessions(agentId);
    }

    setAgents(prev => prev.map(a => 
      a.agent_id === agentId ? { ...a, expanded: !a.expanded } : a
    ));
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getSessionTitle = (session: AgentSession): string => {
    if (session.title) return session.title;
    return `Session ${session.current_step || 0} steps`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No agents found</p>
        <p className="text-xs mt-1">Create an agent in Agent Management</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h2 className="font-semibold text-sm">Chat History</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {agents.map(agent => (
          <div key={agent.agent_id} className="border-b border-border last:border-b-0">
            {/* Agent Header */}
            <button
              onClick={() => toggleAgent(agent.agent_id)}
              className="w-full flex items-center gap-2 p-3 hover:bg-accent text-left"
            >
              {agent.expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <Bot className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium truncate flex-1">{agent.name}</span>
              {agent.sessions && agent.sessions.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {agent.sessions.length}
                </span>
              )}
            </button>

            {/* Sessions List */}
            {agent.expanded && (
              <div className="bg-muted/30">
                {/* New Chat Button */}
                <button
                  onClick={() => onNewChat(agent)}
                  className="w-full flex items-center gap-2 px-3 py-2 pl-9 hover:bg-accent text-left text-sm text-primary"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Chat</span>
                </button>

                {agent.sessionsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : agent.sessions && agent.sessions.length > 0 ? (
                  agent.sessions.map(session => (
                    <button
                      key={session.session_id}
                      onClick={() => onSessionSelect(session, agent)}
                      className={`w-full flex items-center gap-2 px-3 py-2 pl-9 hover:bg-accent text-left ${
                        selectedSessionId === session.session_id 
                          ? 'bg-primary/10 border-l-2 border-primary' 
                          : ''
                      }`}
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{getSessionTitle(session)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(session.created_at)}
                          {session.status === 'completed' && (
                            <span className="ml-2">
                              {session.goal_met ? '✅' : '⏹️'}
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 pl-9 text-xs text-muted-foreground">
                    No chat history
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
