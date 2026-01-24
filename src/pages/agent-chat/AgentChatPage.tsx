import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Bot, Send, Loader2, Bug, MessageSquare, Info } from 'lucide-react';
import PageInfoModal from '@/components/common/PageInfoModal';
import { agentChatInfo } from './agentChatInfo';
import { DebugPanel } from '@/components/agent-chat/DebugPanel';
import { ChatHistorySidebar } from '@/components/agent-chat/ChatHistorySidebar';
import type { Agent, AgentSession, SessionMessage } from '@/types/agent';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used?: number;
  created_at?: string;
}

export default function AgentChatPage(): React.ReactElement {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionIdParam = searchParams.get('sessionId');

  const [agent, setAgent] = useState<Agent | null>(null);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
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

  const loadSession = useCallback(async (sessionId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/agent-sessions?id=${sessionId}`, { 
        headers: getAuthHeaders() 
      });
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
        
        // Fetch agent details
        const agentResponse = await fetch(`/api/agents?id=${data.session.agent_id}`, {
          headers: getAuthHeaders(),
        });
        const agentData = await agentResponse.json() as { success: boolean; agent?: Agent };
        if (agentData.success && agentData.agent) {
          setAgent(agentData.agent);
        }
      } else {
        setError(data.error || 'Failed to fetch session');
      }
    } catch {
      setError('Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // Load session from URL param on mount
  useEffect(() => {
    if (sessionIdParam) {
      void loadSession(sessionIdParam);
    }
  }, [sessionIdParam, loadSession]);

  const handleSessionSelect = (selectedSession: AgentSession, selectedAgent: Agent) => {
    setAgent(selectedAgent);
    setSearchParams({ sessionId: selectedSession.session_id });
  };

  const handleNewChat = async (selectedAgent: Agent) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/agent-sessions?agentId=${selectedAgent.agent_id}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; session?: AgentSession; error?: string };
      
      if (data.success && data.session) {
        setAgent(selectedAgent);
        setSession(data.session);
        setMessages([]);
        setSearchParams({ sessionId: data.session.session_id });
      } else {
        setError(data.error || 'Failed to create session');
      }
    } catch {
      setError('Failed to create new chat');
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async (messageText: string): Promise<boolean> => {
    if (!session) return false;
    
    try {
      const response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          sessionId: session.session_id,
          message: messageText,
        }),
      });

      const data = await response.json() as {
        success: boolean;
        message?: { role: string; content: string; tokens_used?: number };
        session?: { status: string; current_step: number; goal_met: boolean };
        shouldContinue?: boolean;
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

        return data.shouldContinue === true;
      } else {
        setError(data.error || 'Failed to send message');
        return false;
      }
    } catch {
      setError('Failed to send message');
      return false;
    }
  };

  const sendMessage = async (): Promise<void> => {
    if (!inputMessage.trim() || !session || sending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);
    setError(null);

    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    let shouldContinue = await sendChatMessage(userMessage);

    let continuationCount = 0;
    const maxContinuations = 20;

    while (shouldContinue && continuationCount < maxContinuations) {
      continuationCount++;
      await new Promise(resolve => setTimeout(resolve, 500));
      shouldContinue = await sendChatMessage('Continue with the next step of your plan.');
    }

    setSending(false);
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

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Chat History Sidebar */}
      <div className="w-64 border-r border-border bg-card flex-shrink-0">
        <ChatHistorySidebar
          selectedSessionId={session?.session_id || null}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
          {agent ? (
            <>
              <Bot className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <h1 className="font-semibold">{agent.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {session?.status === 'completed' 
                    ? (session.goal_met ? '✅ Goal completed' : '⏹️ Session ended')
                    : `Step ${session?.current_step || 0}`}
                </p>
              </div>
            </>
          ) : (
            <>
              <MessageSquare className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <h1 className="font-semibold">Agent Chat</h1>
                <p className="text-xs text-muted-foreground">Select a chat from the sidebar</p>
              </div>
            </>
          )}
          {session?.status === 'active' && sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          )}
          <button
            onClick={() => setDebugOpen(!debugOpen)}
            className={`p-2 rounded-md hover:bg-accent ${debugOpen ? 'bg-accent text-accent-foreground' : ''}`}
            title="Toggle Debug Panel"
          >
            <Bug className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowInfo(true)}
            className="p-2 rounded-md hover:bg-accent"
            title="View page details"
          >
            <Info className="h-5 w-5" />
          </button>
        </div>

        <PageInfoModal
          isOpen={showInfo}
          onClose={() => setShowInfo(false)}
          content={agentChatInfo}
        />

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
            {/* Main content area - side by side when debug is open */}
            <div className={`flex-1 flex ${debugOpen ? 'flex-row' : 'flex-col'} overflow-hidden`}>
              {/* Messages */}
              <div className={`${debugOpen ? 'w-1/2 border-r border-border' : 'flex-1'} overflow-y-auto p-4 space-y-4`}>
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

              {/* Debug Panel - inline when open */}
              {debugOpen && (
                <div className="w-1/2 overflow-hidden">
                  <DebugPanel
                    sessionId={session?.session_id || null}
                    isOpen={true}
                    onClose={() => setDebugOpen(false)}
                    inline={true}
                  />
                </div>
              )}
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
          </>
        )}

        {/* Debug Panel - overlay mode when not inline */}
        {!debugOpen && (
          <DebugPanel
            sessionId={session?.session_id || null}
            isOpen={false}
            onClose={() => setDebugOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
