import { useState, type FormEvent } from 'react';
import { Send, Loader2, Info } from 'lucide-react';
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
  results?: Record<Provider, ProviderResult>;
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

export default function AiGatewayChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModels, setSelectedModels] = useState<Record<Provider, string>>(DEFAULT_MODELS);
  const [showInfo, setShowInfo] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          models: selectedModels,
        }),
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        results: data.success ? data.results : undefined,
      };

      if (!data.success) {
        assistantMessage.content = data.error || 'An error occurred';
      }

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Failed to connect to the AI service. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
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

      {/* Model Selectors */}
      <div className="grid gap-4 border-b border-border p-4 md:grid-cols-3">
        {(['openai', 'anthropic', 'gemini'] as Provider[]).map((provider) => (
          <div key={provider} className={`rounded-lg border-l-4 bg-card p-3 ${PROVIDER_COLORS[provider]}`}>
            <label
              htmlFor={`model-${provider}`}
              className="mb-1 block text-sm font-medium text-card-foreground"
            >
              {PROVIDER_LABELS[provider]}
            </label>
            <select
              id={`model-${provider}`}
              value={selectedModels[provider]}
              onChange={(e) =>
                setSelectedModels((prev) => ({ ...prev, [provider]: e.target.value }))
              }
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {AVAILABLE_MODELS[provider].map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        ))}
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
                ) : message.results ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {(['openai', 'anthropic', 'gemini'] as Provider[]).map((provider) => {
                      const result = message.results?.[provider];
                      if (!result) return null;
                      return (
                        <div
                          key={provider}
                          className={`rounded-lg border-l-4 bg-card p-4 ${PROVIDER_COLORS[provider]}`}
                        >
                          <h3 className="mb-2 font-semibold text-card-foreground">
                            {PROVIDER_LABELS[provider]}
                          </h3>
                          {result.ok ? (
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                              {result.text}
                            </p>
                          ) : (
                            <p className="text-sm text-destructive">
                              Error: {result.error || 'Unknown error'}
                            </p>
                          )}
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
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Getting responses from AI providers...</span>
              </div>
            )}
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
            disabled={loading || !input.trim()}
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
