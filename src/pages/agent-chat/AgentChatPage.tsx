import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Bot, Send, Square, Loader2 } from 'lucide-react';
import type { Agent, AgentSession, SessionMessage } from '@/types/agent';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used?: number;
  created_at?: string;
}

export default function AgentChatPage(): React.ReactElement {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get('agentId');
  const sessionIdParam = searchParams.get('sessionId');

  const [agent, setAgent] = useState<Agent | null>(null);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchAgent = useCallback(async (): Promise<void> => {
    if (!agentId) return;
    try {
      const response = await fetch(`/api/agents?id=${agentId}`, { headers: getAuthHeaders() });
      const data = await response.json() as { success: boolean; agent?: Agent; error?: string };
      if (data.success && data.agent) {
        setAgent(data.agent);
      } else {
        setError(data.error || 'Failed to fetch agent');
      }
    } catch {
      setError('Failed to fetch agent');
    }
  }, [agentId, getAuthHeaders]);

  const fetchOrCreateSession = useCallback(async (): Promise<void> => {
    if (!agentId) return;

    try {
      if (sessionIdParam) {
        // Fetch existing session
        const response = await fetch(`/api/agent-sessions?id=${sessionIdParam}`, { headers: getAuthHeaders() });
        const data = await response.json() as { 
          success: boolean; 
          session?: AgentSession; 
          messages?: SessionMessage[];
          error?: string 
        };
        if (data.success && data.session) {
          setSession(data.session);
          if (data.messages) {
            setMessages(data.messages.map((m) => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
              tokens_used: m.tokens_used || undefined,
              created_at: m.created_at,
            })));
          }
        } else {
          setError(data.error || 'Failed to fetch session');
        }
      } else {
        // Create new session
        const response = await fetch(`/api/agent-sessions?agentId=${agentId}`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        const data = await response.json() as { success: boolean; session?: AgentSession; error?: string };
        if (data.success && data.session) {
          setSession(data.session);
          // Update URL with session ID
          window.history.replaceState(null, '', `/agent-chat/chat?agentId=${agentId}&sessionId=${data.session.session_id}`);
        } else {
          setError(data.error || 'Failed to create session');
        }
      }
    } catch {
      setError('Failed to load session');
    }
  }, [agentId, sessionIdParam, getAuthHeaders]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchAgent();
      await fetchOrCreateSession();
      setLoading(false);
    };
    void init();
  }, [fetchAgent, fetchOrCreateSession]);

  const sendMessage = async (): Promise<void> => {
    if (!inputMessage.trim() || !session || sending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);
    setError(null);

    // Add user message to UI immediately
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          sessionId: session.session_id,
          message: userMessage,
        }),
      });

      const data = await response.json() as {
        success: boolean;
        message?: { role: string; content: string; tokens_used?: number };
        session?: { status: string; current_step: number; goal_met: boolean };
        error?: string;
      };

      if (data.success && data.message) {
        setMessages((prev) => [...prev, {
          role: data.message!.role as 'assistant',
          content: data.message!.content,
          tokens_used: data.message!.tokens_used,
        }]);

        if (data.session) {
          setSession((prev) => prev ? {
            ...prev,
            status: data.session!.status as AgentSession['status'],
            current_step: data.session!.current_step,
            goal_met: data.session!.goal_met,
          } : null);
        }
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">Please log in to chat with agents.</div>;
  }

  if (!agentId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No agent selected</p>
        <p>Select an agent from the Agent Management page to start chatting.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        <Bot className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h1 className="font-semibold">{agent?.name || 'Agent Chat'}</h1>
          <p className="text-xs text-muted-foreground">
            {session?.status === 'completed' 
              ? (session.goal_met ? '✅ Goal completed' : '⏹️ Session ended')
              : `Step ${session?.current_step || 0}`}
          </p>
        </div>
        {session?.status === 'active' && sending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Start a conversation</p>
            <p className="text-sm">Send a message to begin chatting with {agent?.name}</p>
            {agent?.goal && (
              <p className="text-xs mt-4 max-w-md mx-auto">
                <span className="font-medium">Agent Goal:</span> {agent.goal}
              </p>
            )}
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.tokens_used && (
                <p className="text-xs opacity-70 mt-1">{msg.tokens_used} tokens</p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        {session?.status === 'active' ? (
          <div className="flex gap-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              rows={2}
              disabled={sending}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!inputMessage.trim() || sending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-2">
            <p>This session has ended. {session?.goal_met ? 'Goal was achieved!' : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
}
