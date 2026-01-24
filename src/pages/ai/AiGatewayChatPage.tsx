/* eslint-disable no-console */
import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Send, Loader2, Info, ToggleLeft, ToggleRight } from 'lucide-react';
import PageInfoModal from '@/components/common/PageInfoModal';
import { chatInfo } from './chatInfo';
import {
  AVAILABLE_MODELS as SHARED_MODELS,
  DEFAULT_MODELS as SHARED_DEFAULTS,
  PROVIDER_LABELS as SHARED_LABELS,
} from '@/components/common/ModelSelector';

type Provider = 'openai' | 'anthropic' | 'gemini';

interface ProviderResult {
  ok: boolean;
  text?: string;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  results?: Partial<Record<Provider, ProviderResult>>;
  enabledProviders?: Provider[];
  loading?: boolean;
  jobId?: string;
}

interface JobStatusResponse {
  success: boolean;
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results: Record<string, ProviderResult>;
  enabledProviders: Provider[];
  error?: string;
}

interface TriggerResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: SHARED_LABELS.openai,
  anthropic: SHARED_LABELS.anthropic,
  gemini: SHARED_LABELS.google,
};

const PROVIDER_COLORS: Record<Provider, string> = {
  openai: 'border-green-500',
  anthropic: 'border-orange-500',
  gemini: 'border-blue-500',
};

const AVAILABLE_MODELS: Record<Provider, { id: string; name: string }[]> = {
  openai: SHARED_MODELS.openai,
  anthropic: SHARED_MODELS.anthropic,
  gemini: SHARED_MODELS.google,
};

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: SHARED_DEFAULTS.openai,
  anthropic: SHARED_DEFAULTS.anthropic,
  gemini: SHARED_DEFAULTS.google,
};

const POLL_INTERVAL = 1000; // 1 second

export default function AiGatewayChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModels, setSelectedModels] = useState<Record<Provider, string>>(DEFAULT_MODELS);
  const [enabledProviders, setEnabledProviders] = useState<Record<Provider, boolean>>({
    openai: true,
    anthropic: true,
    gemini: true,
  });
  const [showInfo, setShowInfo] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return (): void => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, []);

  const toggleProvider = (provider: Provider): void => {
    setEnabledProviders((prev) => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  const getEnabledProvidersList = (): Provider[] => {
    return (['openai', 'anthropic', 'gemini'] as Provider[]).filter(
      (p) => enabledProviders[p]
    );
  };

  const startPolling = (jobId: string, messageId: string): void => {
    const poll = (): void => {
      fetch(`/api/ai/chat-status?jobId=${jobId}`)
        .then((response) => response.json() as Promise<JobStatusResponse>)
        .then((data) => {
          if (!data.success) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId
                  ? { ...m, loading: false, content: data.error || 'Failed to get job status' }
                  : m
              )
            );
            setLoading(false);
            return;
          }

          // Update message with current results
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    results: data.results as Partial<Record<Provider, ProviderResult>>,
                    loading: data.status !== 'completed' && data.status !== 'failed',
                  }
                : m
            )
          );

          // Continue polling if not complete
          if (data.status !== 'completed' && data.status !== 'failed') {
            pollingRef.current = setTimeout(poll, POLL_INTERVAL);
          } else {
            setLoading(false);
          }
        })
        .catch((error: unknown) => {
          console.error('Polling error:', error);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, loading: false, content: 'Failed to poll job status' }
                : m
            )
          );
          setLoading(false);
        });
    };

    poll();
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const enabledList = getEnabledProvidersList();
    if (enabledList.length === 0) {
      alert('Please enable at least one AI provider');
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      results: {},
      enabledProviders: enabledList,
      loading: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setLoading(true);

    fetch('/api/ai/chat-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage.content,
        models: selectedModels,
        enabledProviders: enabledList,
      }),
    })
      .then((response) => response.json() as Promise<TriggerResponse>)
      .then((data) => {
        if (!data.success) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, loading: false, content: data.error || 'Failed to start job' }
                : m
            )
          );
          setLoading(false);
          return;
        }

        // Start polling for results
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, jobId: data.jobId } : m
          )
        );

        if (data.jobId) {
          startPolling(data.jobId, assistantMessageId);
        }
      })
      .catch((error: unknown) => {
        console.error('Submit error:', error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, loading: false, content: 'Failed to connect to the AI service' }
              : m
          )
        );
        setLoading(false);
      });
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Gateway Chat</h1>
          <p className="text-muted-foreground">Compare responses from multiple AI providers</p>
        </div>
        <button
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="View technical documentation"
        >
          <Info className="h-4 w-4" />
          <span>Details</span>
        </button>
      </div>

      <PageInfoModal
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        content={chatInfo}
      />

      {/* Model Selectors with Toggles */}
      <div className="grid gap-4 border-b border-border p-4 md:grid-cols-3">
        {(['openai', 'anthropic', 'gemini'] as Provider[]).map((provider) => {
          const isEnabled = enabledProviders[provider];
          return (
            <div
              key={provider}
              className={`rounded-lg border-l-4 bg-card p-3 transition-opacity ${PROVIDER_COLORS[provider]} ${
                !isEnabled ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor={`model-${provider}`}
                  className="text-sm font-medium text-card-foreground"
                >
                  {PROVIDER_LABELS[provider]}
                </label>
                <button
                  type="button"
                  onClick={() => toggleProvider(provider)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={isEnabled ? `Disable ${PROVIDER_LABELS[provider]}` : `Enable ${PROVIDER_LABELS[provider]}`}
                >
                  {isEnabled ? (
                    <ToggleRight className="h-6 w-6 text-primary" />
                  ) : (
                    <ToggleLeft className="h-6 w-6" />
                  )}
                </button>
              </div>
              <select
                id={`model-${provider}`}
                value={selectedModels[provider]}
                onChange={(e) =>
                  setSelectedModels((prev) => ({ ...prev, [provider]: e.target.value }))
                }
                disabled={!isEnabled}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {AVAILABLE_MODELS[provider].map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">
              Ask a question to get responses from AI providers
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-2xl rounded-lg bg-primary px-4 py-2 text-primary-foreground">
                      {message.content}
                    </div>
                  </div>
                ) : message.results || message.loading ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {(message.enabledProviders || ['openai', 'anthropic', 'gemini'] as Provider[]).map((provider) => {
                      const result = message.results?.[provider];
                      const isLoading = message.loading && !result;
                      return (
                        <div
                          key={provider}
                          className={`rounded-lg border-l-4 bg-card p-4 ${PROVIDER_COLORS[provider]}`}
                        >
                          <h3 className="mb-2 font-semibold text-card-foreground flex items-center gap-2">
                            {PROVIDER_LABELS[provider]}
                            {isLoading && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </h3>
                          {result ? (
                            result.ok ? (
                              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                {result.text}
                              </p>
                            ) : (
                              <p className="text-sm text-destructive">
                                Error: {result.error || 'Unknown error'}
                              </p>
                            )
                          ) : isLoading ? (
                            <p className="text-sm text-muted-foreground italic">
                              Waiting for response...
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
                    {message.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={loading}
            className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || getEnabledProvidersList().length === 0}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
