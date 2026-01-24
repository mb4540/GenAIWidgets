import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { AiChatHistorySidebar } from '@/components/ai-chat/AiChatHistorySidebar';
import ModelSelector, { DEFAULT_MODELS } from '@/components/common/ModelSelector';

interface AiChatSession {
  session_id: string;
  title: string | null;
  model_provider: string;
  model_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AiChatMessage {
  message_id: string;
  role: string;
  content: string;
  tokens_used: number | null;
  created_at: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  tokens_used?: number;
}

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function AiChatPage(): React.ReactElement {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionIdParam = searchParams.get('sessionId');

  const [session, setSession] = useState<AiChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Model selection for new chats
  const [newChatProvider, setNewChatProvider] = useState('openai');
  const [newChatModel, setNewChatModel] = useState(DEFAULT_MODELS.openai);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSession = useCallback(async (sessionId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai-chat-sessions?id=${sessionId}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json() as {
        success: boolean;
        session?: AiChatSession;
        messages?: AiChatMessage[];
        error?: string;
      };

      if (data.success && data.session) {
        setSession(data.session);
        if (data.messages) {
          setMessages(data.messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            tokens_used: m.tokens_used || undefined,
          })));
        }
      } else {
        setError(data.error || 'Failed to fetch session');
      }
    } catch {
      setError('Failed to load session');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionIdParam) {
      void loadSession(sessionIdParam);
    } else {
      setSession(null);
      setMessages([]);
    }
  }, [sessionIdParam, loadSession]);

  const handleSessionSelect = (selectedSession: AiChatSession) => {
    setSearchParams({ sessionId: selectedSession.session_id });
  };

  const handleNewChat = () => {
    setShowNewChatModal(true);
  };

  const createNewSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai-chat-sessions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          model_provider: newChatProvider,
          model_name: newChatModel,
        }),
      });
      const data = await response.json() as { success: boolean; session?: AiChatSession; error?: string };

      if (data.success && data.session) {
        setSession(data.session);
        setMessages([]);
        setSearchParams({ sessionId: data.session.session_id });
        setShowNewChatModal(false);
        setRefreshTrigger(prev => prev + 1);
      } else {
        setError(data.error || 'Failed to create session');
      }
    } catch {
      setError('Failed to create new chat');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this chat?')) return;

    try {
      const response = await fetch(`/api/ai-chat-sessions?id=${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; error?: string };

      if (data.success) {
        if (session?.session_id === sessionId) {
          setSession(null);
          setMessages([]);
          setSearchParams({});
        }
        setRefreshTrigger(prev => prev + 1);
      } else {
        setError(data.error || 'Failed to delete session');
      }
    } catch {
      setError('Failed to delete chat');
    }
  };

  const sendMessage = async (): Promise<void> => {
    if (!inputMessage.trim() || !session || sending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);
    setError(null);

    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await fetch('/api/ai-chat-single', {
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
        error?: string;
      };

      if (data.success && data.message) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data.message!.content,
          tokens_used: data.message!.tokens_used,
        }]);
        setRefreshTrigger(prev => prev + 1);
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
    return <div className="p-8 text-center text-muted-foreground">Please log in to use AI Chat.</div>;
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Chat History Sidebar */}
      <div className="w-64 border-r border-border bg-card flex-shrink-0">
        <AiChatHistorySidebar
          selectedSessionId={session?.session_id || null}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
          <MessageSquare className="h-6 w-6 text-primary" />
          <div className="flex-1">
            <h1 className="font-semibold">
              {session ? (session.title || 'New Chat') : 'AI Chat'}
            </h1>
            {session && (
              <p className="text-xs text-muted-foreground">
                {session.model_provider} / {session.model_name}
              </p>
            )}
          </div>
          {sending && (
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

        {/* Content Area */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !session ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No chat selected</p>
              <p className="text-sm">Select a chat from the sidebar or start a new one</p>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Start a conversation</p>
                  <p className="text-sm">Send a message to begin chatting</p>
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
            </div>
          </>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">New Chat</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select the AI model you want to chat with.
            </p>
            
            <ModelSelector
              provider={newChatProvider}
              model={newChatModel}
              onProviderChange={setNewChatProvider}
              onModelChange={setNewChatModel}
              className="mb-6"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNewChatModal(false)}
                className="px-4 py-2 text-sm rounded-md hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => void createNewSession()}
                disabled={loading}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start Chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
