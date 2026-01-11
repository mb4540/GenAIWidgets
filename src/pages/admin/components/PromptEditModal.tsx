import React from 'react';
import { X, Save } from 'lucide-react';
import ModelSelector from '@/components/common/ModelSelector';

interface Prompt {
  id: string;
  functionName: string;
  displayName: string;
  description: string | null;
  modelProvider: string;
  modelName: string;
  systemPrompt: string | null;
  userPromptTemplate: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  version: number;
  updatedAt: string;
}

interface PromptFormData {
  displayName: string;
  description: string;
  modelProvider: string;
  modelName: string;
  systemPrompt: string;
  userPromptTemplate: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
}

interface PromptEditModalProps {
  prompt: Prompt;
  formData: PromptFormData;
  onFormChange: (data: PromptFormData) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function PromptEditModal({
  prompt,
  formData,
  onFormChange,
  onSave,
  onClose,
}: PromptEditModalProps): React.ReactElement {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Edit Prompt: {prompt.displayName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Function Name</label>
            <input
              type="text"
              value={prompt.functionName}
              disabled
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Display Name</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => onFormChange({ ...formData, displayName: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <ModelSelector
            provider={formData.modelProvider}
            model={formData.modelName}
            onProviderChange={(provider) => onFormChange({ ...formData, modelProvider: provider })}
            onModelChange={(model) => onFormChange({ ...formData, modelName: model })}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={formData.temperature}
                onChange={(e) => onFormChange({ ...formData, temperature: parseFloat(e.target.value) })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Tokens</label>
              <input
                type="number"
                value={formData.maxTokens}
                onChange={(e) => onFormChange({ ...formData, maxTokens: parseInt(e.target.value, 10) })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">System Prompt (optional)</label>
            <textarea
              value={formData.systemPrompt}
              onChange={(e) => onFormChange({ ...formData, systemPrompt: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">User Prompt Template</label>
            <textarea
              value={formData.userPromptTemplate}
              onChange={(e) => onFormChange({ ...formData, userPromptTemplate: e.target.value })}
              rows={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => onFormChange({ ...formData, isActive: e.target.checked })}
              className="rounded"
            />
            Active
          </label>

          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90"
            >
              <Save className="h-4 w-4" /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { Prompt, PromptFormData };
