import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, MessageSquare, Loader2, Trash2 } from 'lucide-react';

interface AiChatSession {
  session_id: string;
  title: string | null;
  model_provider: string;
  model_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AiChatHistorySidebarProps {
  selectedSessionId: string | null;
  onSessionSelect: (session: AiChatSession) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  refreshTrigger?: number;
}

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google',
  google: 'Google',
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  anthropic: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  gemini: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  google: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

export const AiChatHistorySidebar: React.FC<AiChatHistorySidebarProps> = ({
  selectedSessionId,
  onSessionSelect,
  onNewChat,
  onDeleteSession,
  refreshTrigger,
}) => {
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({
    openai: true,
    anthropic: true,
    gemini: true,
    google: true,
  });

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai-chat-sessions', { headers: getAuthHeaders() });
      const data = await response.json() as { success: boolean; sessions?: AiChatSession[]; error?: string };
      if (data.success && data.sessions) {
        setSessions(data.sessions);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch sessions');
      }
    } catch {
      setError('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions, refreshTrigger]);

  const toggleProvider = (provider: string) => {
    setExpandedProviders(prev => ({ ...prev, [provider]: !prev[provider] }));
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

  const getSessionTitle = (session: AiChatSession): string => {
    if (session.title) return session.title;
    return 'New Chat';
  };

  // Group sessions by provider
  const sessionsByProvider = sessions.reduce((acc, session) => {
    const provider = session.model_provider;
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(session);
    return acc;
  }, {} as Record<string, AiChatSession[]>);

  const providers = Object.keys(sessionsByProvider).sort();

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

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h2 className="font-semibold text-sm">Chat History</h2>
      </div>

      {/* New Chat Button */}
      <div className="p-2 border-b border-border">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span>New Chat</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No chat history</p>
            <p className="text-xs mt-1">Start a new chat above</p>
          </div>
        ) : (
          providers.map(provider => (
            <div key={provider} className="border-b border-border last:border-b-0">
              {/* Provider Header */}
              <button
                onClick={() => toggleProvider(provider)}
                className="w-full flex items-center gap-2 p-3 hover:bg-accent text-left"
              >
                {expandedProviders[provider] ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${PROVIDER_COLORS[provider] || 'bg-gray-100 text-gray-800'}`}>
                  {PROVIDER_LABELS[provider] || provider}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {sessionsByProvider[provider]?.length || 0}
                </span>
              </button>

              {/* Sessions List */}
              {expandedProviders[provider] && (
                <div className="bg-muted/30">
                  {sessionsByProvider[provider]?.map(session => (
                    <div
                      key={session.session_id}
                      className={`group flex items-center gap-2 px-3 py-2 pl-9 hover:bg-accent cursor-pointer ${
                        selectedSessionId === session.session_id 
                          ? 'bg-primary/10 border-l-2 border-primary' 
                          : ''
                      }`}
                    >
                      <button
                        onClick={() => onSessionSelect(session)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{getSessionTitle(session)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(session.created_at)}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.session_id);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                        title="Delete chat"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
