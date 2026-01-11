import React from 'react';

type Provider = 'openai' | 'anthropic' | 'google';

interface ModelOption {
  id: string;
  name: string;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
};

const AVAILABLE_MODELS: Record<Provider, ModelOption[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
    { id: 'gpt-5', name: 'GPT-5' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
    { id: 'o3-mini', name: 'O3 Mini' },
    { id: 'o4-mini', name: 'O4 Mini' },
  ],
  anthropic: [
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
  ],
  google: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro Preview' },
    { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
  ],
};

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  google: 'gemini-2.0-flash',
};

interface ModelSelectorProps {
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  showLabels?: boolean;
  className?: string;
}

export default function ModelSelector({
  provider,
  model,
  onProviderChange,
  onModelChange,
  showLabels = true,
  className = '',
}: ModelSelectorProps): React.ReactElement {
  const normalizedProvider = (provider === 'gemini' ? 'google' : provider) as Provider;
  const models = AVAILABLE_MODELS[normalizedProvider] || [];

  const handleProviderChange = (newProvider: string): void => {
    onProviderChange(newProvider);
    const defaultModel = DEFAULT_MODELS[newProvider as Provider];
    if (defaultModel) {
      onModelChange(defaultModel);
    }
  };

  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      <div>
        {showLabels && (
          <label className="block text-sm font-medium mb-1">Model Provider</label>
        )}
        <select
          value={normalizedProvider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        {showLabels && (
          <label className="block text-sm font-medium mb-1">Model Name</label>
        )}
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          {!models.find((m) => m.id === model) && model && (
            <option value={model}>{model}</option>
          )}
        </select>
      </div>
    </div>
  );
}

export { AVAILABLE_MODELS, DEFAULT_MODELS, PROVIDER_LABELS };
export type { Provider, ModelOption };
