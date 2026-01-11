import React from 'react';
import { X, Info, Database, Server, FileCode } from 'lucide-react';

interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  requestBody?: string;
  responseBody?: string;
}

interface TableInfo {
  name: string;
  description: string;
  columns: string[];
  relationships?: string[];
}

interface PageInfoContent {
  title: string;
  overview: string;
  architecture: string;
  tables: TableInfo[];
  apis: APIEndpoint[];
}

interface PageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: PageInfoContent;
}

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
  PATCH: 'bg-purple-100 text-purple-800',
};

export type { PageInfoContent, APIEndpoint, TableInfo };

export default function PageInfoModal({
  isOpen,
  onClose,
  content,
}: PageInfoModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden ml-16">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{content.title} - Technical Documentation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-60px)] p-6 space-y-8">
          {/* Executive Overview */}
          <section>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              Executive Overview
            </h3>
            <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line">
              {content.overview}
            </div>
          </section>

          {/* Architecture */}
          <section>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Architecture
            </h3>
            <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line font-mono">
              {content.architecture}
            </div>
          </section>

          {/* Tables & Entity Relationships */}
          <section>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Database Tables & Relationships
            </h3>
            <div className="space-y-4">
              {content.tables.map((table) => (
                <div key={table.name} className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 font-mono font-semibold text-sm">
                    {table.name}
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">{table.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {table.columns.map((col) => (
                        <span key={col} className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {col}
                        </span>
                      ))}
                    </div>
                    {table.relationships && table.relationships.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium">Relationships:</span>{' '}
                        {table.relationships.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* API Endpoints */}
          <section>
            <h3 className="text-xl font-semibold mb-3">API Endpoints</h3>
            <div className="space-y-3">
              {content.apis.map((api, index) => (
                <div key={index} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-2 bg-muted/50">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${methodColors[api.method]}`}>
                      {api.method}
                    </span>
                    <span className="font-mono text-sm">{api.path}</span>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm">{api.description}</p>
                    {api.requestBody && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Request Body:</span>
                        <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">{api.requestBody}</pre>
                      </div>
                    )}
                    {api.responseBody && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Response:</span>
                        <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">{api.responseBody}</pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
