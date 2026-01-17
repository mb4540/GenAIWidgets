import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Agent, AgentInput, ModelProvider } from '@/types/agent';

interface AgentFormProps {
  agent?: Agent;
  onSubmit: (input: AgentInput) => Promise<void>;
  onCancel: () => void;
}

const MODEL_OPTIONS: Record<ModelProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
};

export default function AgentForm({
  agent,
  onSubmit,
  onCancel,
}: AgentFormProps): React.ReactElement {
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [goal, setGoal] = useState(agent?.goal || '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || '');
  const [modelProvider, setModelProvider] = useState<ModelProvider>(agent?.model_provider || 'openai');
  const [modelName, setModelName] = useState(agent?.model_name || 'gpt-4o');
  const [maxSteps, setMaxSteps] = useState(agent?.max_steps || 10);
  const [temperature, setTemperature] = useState(agent?.temperature || 0.7);
  const [isActive, setIsActive] = useState(agent?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!MODEL_OPTIONS[modelProvider].includes(modelName)) {
      const defaultModel = MODEL_OPTIONS[modelProvider][0];
      if (defaultModel) {
        setModelName(defaultModel);
      }
    }
  }, [modelProvider, modelName]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Agent name is required');
      return;
    }
    if (!goal.trim()) {
      setError('Agent goal is required');
      return;
    }
    if (!systemPrompt.trim()) {
      setError('System prompt is required');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        goal: goal.trim(),
        system_prompt: systemPrompt.trim(),
        model_provider: modelProvider,
        model_name: modelName,
        max_steps: maxSteps,
        temperature,
        is_active: isActive,
      });
    } catch {
      setError('Failed to save agent');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {agent ? 'Edit Agent' : 'Create New Agent'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Assistant"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A helpful assistant that..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Goal *</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Help users accomplish..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              The primary objective this agent should work towards
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">System Prompt *</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant that..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono text-xs"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Instructions that define the agent's behavior and personality
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Model Provider *</label>
              <select
                value={modelProvider}
                onChange={(e) => setModelProvider(e.target.value as ModelProvider)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Model *</label>
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {MODEL_OPTIONS[modelProvider].map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Max Steps: {maxSteps}
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={maxSteps}
                onChange={(e) => setMaxSteps(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum iterations before forced stop
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Temperature: {temperature.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Higher = more creative, lower = more focused
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="isActive" className="text-sm">
              Agent is active and available for use
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : agent ? 'Update Agent' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
