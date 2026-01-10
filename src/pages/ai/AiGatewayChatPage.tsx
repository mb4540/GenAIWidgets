import { useState, type FormEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';

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
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
};

const PROVIDER_COLORS: Record<Provider, string> = {
  openai: 'border-green-500',
  anthropic: 'border-orange-500',
  gemini: 'border-blue-500',
};

export default function AiGatewayChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'all' | Provider>('all');

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
      const providers = {
        openai: selectedMode === 'all' || selectedMode === 'openai',
        anthropic: selectedMode === 'all' || selectedMode === 'anthropic',
        gemini: selectedMode === 'all' || selectedMode === 'gemini',
      };

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, providers }),
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
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">AI Gateway Chat</h1>
          <div className="flex items-center gap-2">
            <label htmlFor="mode-select" className="text-sm text-muted-foreground">
              Mode:
            </label>
            <select
              id="mode-select"
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as 'all' | Provider)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Ask All (OpenAI + Anthropic + Gemini)</option>
              <option value="openai">OpenAI Only</option>
              <option value="anthropic">Anthropic Only</option>
              <option value="gemini">Gemini Only</option>
            </select>
          </div>
        </div>
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
                    {(Object.keys(message.results) as Provider[]).map((provider) => {
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
