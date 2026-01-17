import React, { useState, useMemo } from 'react';
import { Wrench, Trash2, Pencil, Server, Code, Zap, ZapOff } from 'lucide-react';
import type { AgentTool } from '@/types/agent';

interface ToolListProps {
  tools: AgentTool[];
  onEdit: (tool: AgentTool) => void;
  onDelete: (toolId: string) => Promise<void>;
}

export default function ToolList({
  tools,
  onEdit,
  onDelete,
}: ToolListProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
    );
  }, [tools, searchQuery]);

  const getToolTypeIcon = (toolType: string): React.ReactElement => {
    switch (toolType) {
      case 'mcp_server':
        return <Server className="h-4 w-4" />;
      case 'python_script':
        return <Code className="h-4 w-4" />;
      default:
        return <Wrench className="h-4 w-4" />;
    }
  };

  const getToolTypeBadgeColor = (toolType: string): string => {
    switch (toolType) {
      case 'mcp_server':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'python_script':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tools by name or description..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {filteredTools.length === 0 && tools.length > 0 && (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">
          No tools match your search
        </div>
      )}

      {tools.length === 0 && (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">
          <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No tools yet</p>
          <p>Create your first tool to extend agent capabilities</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTools.map((tool) => (
          <div
            key={tool.tool_id}
            className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                <h3 className="font-semibold truncate">{tool.name}</h3>
              </div>
              <div className="flex items-center gap-1" title={tool.is_active ? 'Active' : 'Inactive'}>
                {tool.is_active ? (
                  <Zap className="h-4 w-4 text-green-500" />
                ) : (
                  <ZapOff className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {tool.description}
            </p>

            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${getToolTypeBadgeColor(tool.tool_type)}`}>
                {getToolTypeIcon(tool.tool_type)}
                {tool.tool_type === 'mcp_server' ? 'MCP Server' : 'Python Script'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                {Object.keys(tool.input_schema).length > 0 
                  ? `${Object.keys(tool.input_schema).length} schema fields`
                  : 'No schema defined'}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(tool)}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                  title="Edit tool"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => void onDelete(tool.tool_id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive"
                  title="Delete tool"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
