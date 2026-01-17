import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Sparkles, Loader2 } from 'lucide-react';
import type { Agent, AgentInput, AgentTool, ModelProvider } from '@/types/agent';
import { AVAILABLE_MODELS } from '@/components/common/ModelSelector';

interface AgentFormProps {
  agent?: Agent;
  onSubmit: (input: AgentInput) => Promise<void>;
  onCancel: () => void;
}

// Map ModelProvider to ModelSelector provider keys
const PROVIDER_MAP: Record<ModelProvider, 'openai' | 'anthropic' | 'google'> = {
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'google',
};

// Get model IDs from the shared AVAILABLE_MODELS
const MODEL_OPTIONS: Record<ModelProvider, string[]> = {
  openai: AVAILABLE_MODELS.openai.map((m) => m.id),
  anthropic: AVAILABLE_MODELS.anthropic.map((m) => m.id),
  gemini: AVAILABLE_MODELS.google.map((m) => m.id),
};

// Get display names for models
const MODEL_NAMES: Record<string, string> = {
  ...Object.fromEntries(AVAILABLE_MODELS.openai.map((m) => [m.id, m.name])),
  ...Object.fromEntries(AVAILABLE_MODELS.anthropic.map((m) => [m.id, m.name])),
  ...Object.fromEntries(AVAILABLE_MODELS.google.map((m) => [m.id, m.name])),
};

export default function AgentForm({
  agent,
  onSubmit,
  onCancel,
}: AgentFormProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'agent' | 'tools'>('agent');
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

  const [availableTools, setAvailableTools] = useState<AgentTool[]>([]);
  const [assignedToolIds, setAssignedToolIds] = useState<Set<string>>(new Set());
  const [loadingTools, setLoadingTools] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  useEffect(() => {
    if (!MODEL_OPTIONS[modelProvider].includes(modelName)) {
      const defaultModel = MODEL_OPTIONS[modelProvider][0];
      if (defaultModel) {
        setModelName(defaultModel);
      }
    }
  }, [modelProvider, modelName]);

  useEffect(() => {
    if (agent) {
      const fetchToolsAndAssignments = async () => {
        setLoadingTools(true);
        try {
          const [toolsRes, assignedRes] = await Promise.all([
            fetch('/api/agent-tools', { headers: getAuthHeaders() }),
            fetch(`/api/agent-tools?action=assigned&agentId=${agent.agent_id}`, { headers: getAuthHeaders() }),
          ]);
          const toolsData = await toolsRes.json() as { success: boolean; tools?: AgentTool[] };
          const assignedData = await assignedRes.json() as { success: boolean; tools?: AgentTool[] };
          
          if (toolsData.success && toolsData.tools) {
            setAvailableTools(toolsData.tools);
          }
          if (assignedData.success && assignedData.tools) {
            setAssignedToolIds(new Set(assignedData.tools.map(t => t.tool_id)));
          }
        } catch {
          console.error('Failed to fetch tools');
        } finally {
          setLoadingTools(false);
        }
      };
      void fetchToolsAndAssignments();
    }
  }, [agent, getAuthHeaders]);

  const canGeneratePrompt = name.trim() && description.trim() && goal.trim();

  const handleGeneratePrompt = async () => {
    if (!canGeneratePrompt || generatingPrompt) return;
    
    setGeneratingPrompt(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate-agent-prompt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          goal: goal.trim(),
        }),
      });
      
      const data = await response.json() as { success: boolean; prompt?: string; error?: string };
      
      if (data.success && data.prompt) {
        setSystemPrompt(data.prompt);
      } else {
        setError(data.error || 'Failed to generate prompt');
      }
    } catch {
      setError('Failed to generate prompt');
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleToggleTool = async (toolId: string) => {
    if (!agent) return;
    const isAssigned = assignedToolIds.has(toolId);
    const method = isAssigned ? 'DELETE' : 'POST';
    
    try {
      const response = await fetch(
        `/api/agent-tools?action=assign&agentId=${agent.agent_id}&toolId=${toolId}`,
        { method, headers: getAuthHeaders() }
      );
      if (response.ok) {
        setAssignedToolIds(prev => {
          const next = new Set(prev);
          if (isAssigned) {
            next.delete(toolId);
          } else {
            next.add(toolId);
          }
          return next;
        });
      }
    } catch {
      console.error('Failed to toggle tool assignment');
    }
  };

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

        {agent && (
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab('agent')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'agent'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Agent
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tools')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'tools'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tools ({assignedToolIds.size})
            </button>
          </div>
        )}

        {activeTab === 'tools' && agent ? (
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select tools this agent can use. Assigned tools will be available during chat.
            </p>
            {loadingTools ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : availableTools.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No tools available. Create tools first from Agent Tools.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableTools.map((tool) => {
                  const isAssigned = assignedToolIds.has(tool.tool_id);
                  return (
                    <label
                      key={tool.tool_id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isAssigned
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isAssigned
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground'
                        }`}
                        onClick={() => void handleToggleTool(tool.tool_id)}
                      >
                        {isAssigned && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => void handleToggleTool(tool.tool_id)}>
                        <div className="font-medium">{tool.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{tool.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">System Prompt *</label>
              <button
                type="button"
                onClick={() => void handleGeneratePrompt()}
                disabled={!canGeneratePrompt || generatingPrompt}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={!canGeneratePrompt ? 'Fill in Name, Description, and Goal first' : 'Generate system prompt using AI'}
              >
                {generatingPrompt ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {generatingPrompt ? 'Generating...' : 'Build with AI'}
              </button>
            </div>
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
                    {MODEL_NAMES[model] || model}
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
                max="1"
                step="0.05"
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
        )}
      </div>
    </div>
  );
}
