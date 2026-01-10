import React from 'react';
import { Edit2, Shield, ShieldOff } from 'lucide-react';
import type { Prompt } from './PromptEditModal';

interface PromptsTabProps {
  prompts: Prompt[];
  onEdit: (prompt: Prompt) => void;
  onToggleActive: (prompt: Prompt) => void;
}

export default function PromptsTab({
  prompts,
  onEdit,
  onToggleActive,
}: PromptsTabProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">LLM Prompts</h2>
      </div>

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {prompts.map((prompt) => (
          <div key={prompt.id} className="flex items-center justify-between p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{prompt.displayName}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${prompt.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {prompt.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded">v{prompt.version}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {prompt.modelProvider}/{prompt.modelName} • {prompt.functionName}
              </div>
              {prompt.description && (
                <div className="text-sm text-muted-foreground mt-1">{prompt.description}</div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggleActive(prompt)}
                className={`p-2 ${prompt.isActive ? 'text-green-600' : 'text-muted-foreground'} hover:text-primary`}
                title={prompt.isActive ? 'Deactivate' : 'Activate'}
              >
                {prompt.isActive ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              </button>
              <button
                onClick={() => onEdit(prompt)}
                className="p-2 text-muted-foreground hover:text-primary"
                title="Edit"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {prompts.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">No prompts configured</div>
        )}
      </div>
    </div>
  );
}
