import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { AgentTool, ToolInput, ToolType } from '@/types/agent';

interface ToolFormProps {
  tool?: AgentTool;
  onSubmit: (input: ToolInput) => Promise<void>;
  onCancel: () => void;
}

const DEFAULT_SCHEMA = {
  type: 'object',
  properties: {},
  required: [],
};

export default function ToolForm({
  tool,
  onSubmit,
  onCancel,
}: ToolFormProps): React.ReactElement {
  const isBuiltin = tool?.tool_type === 'builtin';
  const [name, setName] = useState(tool?.name || '');
  const [description, setDescription] = useState(tool?.description || '');
  const [toolType, setToolType] = useState<ToolType>(tool?.tool_type || 'mcp_server');
  const [inputSchema, setInputSchema] = useState(
    tool?.input_schema ? JSON.stringify(tool.input_schema, null, 2) : JSON.stringify(DEFAULT_SCHEMA, null, 2)
  );
  const [isActive, setIsActive] = useState(tool?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Tool name is required');
      return;
    }
    if (!description.trim()) {
      setError('Tool description is required');
      return;
    }

    let parsedSchema: Record<string, unknown>;
    try {
      parsedSchema = JSON.parse(inputSchema) as Record<string, unknown>;
    } catch {
      setError('Invalid JSON in input schema');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        tool_type: toolType,
        input_schema: parsedSchema,
        is_active: isActive,
      });
    } catch {
      setError('Failed to save tool');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {tool ? 'Edit Tool' : 'Create New Tool'}
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
              placeholder="get_weather"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              required
              disabled={isBuiltin}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Function name that the LLM will use to call this tool
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Get the current weather for a given location"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              required
              disabled={isBuiltin}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Clear description helps the LLM understand when to use this tool
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tool Type *</label>
            <select
              value={toolType}
              onChange={(e) => setToolType(e.target.value as ToolType)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={isBuiltin}
            >
              <option value="builtin">Builtin (System)</option>
              <option value="mcp_server">MCP Server</option>
              <option value="python_script" disabled>Python Script (Coming Soon)</option>
            </select>
            {isBuiltin && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Builtin tools are system-provided and cannot be modified
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Input Schema (JSON Schema) *</label>
            <textarea
              value={inputSchema}
              onChange={(e) => setInputSchema(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[200px] font-mono text-xs"
              required
              disabled={isBuiltin}
            />
            <p className="text-xs text-muted-foreground mt-1">
              JSON Schema defining the parameters this tool accepts
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-input"
              disabled={isBuiltin}
            />
            <label htmlFor="isActive" className="text-sm">
              Tool is active and available for use
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
            {!isBuiltin && (
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : tool ? 'Update Tool' : 'Create Tool'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
