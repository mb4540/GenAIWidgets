import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, X } from 'lucide-react';

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

interface DebugEntry {
  timestamp: string;
  type: 'request' | 'response' | 'tool_call' | 'error' | 'info';
  endpoint: string;
  data: unknown;
}

interface SessionMessage {
  message_id: string;
  step_number: number;
  role: string;
  content: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_output?: unknown;
  created_at: string;
}

interface SessionMemory {
  memory_id: string;
  memory_key: string;
  memory_value: unknown;
  created_at: string;
}

interface DebugPanelProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ sessionId, isOpen, onClose }) => {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [sessionMessages, setSessionMessages] = useState<SessionMessage[]>([]);
  const [sessionMemory, setSessionMemory] = useState<SessionMemory[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    requests: true,
    messages: true,
    memory: true,
  });
  const [loading, setLoading] = useState(false);

  const addEntry = useCallback((entry: Omit<DebugEntry, 'timestamp'>) => {
    setEntries(prev => [...prev, { ...entry, timestamp: new Date().toISOString() }]);
  }, []);

  const fetchDebugData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);

    try {
      // Fetch session messages
      const messagesRes = await fetch(`/api/agent-sessions?sessionId=${sessionId}&includeMessages=true`, {
        headers: getAuthHeaders(),
      });
      const messagesData = await messagesRes.json();
      if (messagesData.success && messagesData.data?.messages) {
        setSessionMessages(messagesData.data.messages);
      }

      // Fetch session memory (including execution plan)
      const memoryRes = await fetch(`/api/session-memory?sessionId=${sessionId}`, {
        headers: getAuthHeaders(),
      });
      const memoryData = await memoryRes.json();
      if (memoryData.success && memoryData.data) {
        // Wrap single memory in array for display
        setSessionMemory(Array.isArray(memoryData.data) ? memoryData.data : [memoryData.data]);
      } else {
        setSessionMemory([]);
      }

      addEntry({
        type: 'info',
        endpoint: 'debug-refresh',
        data: { messages: messagesData.data?.messages?.length || 0, memoryFound: !!memoryData.data },
      });
    } catch (error) {
      addEntry({
        type: 'error',
        endpoint: 'debug-refresh',
        data: { error: String(error) },
      });
    } finally {
      setLoading(false);
    }
  }, [sessionId, addEntry]);

  useEffect(() => {
    if (isOpen && sessionId) {
      void fetchDebugData();
    }
  }, [isOpen, sessionId, fetchDebugData]);

  // Intercept fetch to log requests
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      
      // Only log API calls
      if (url.includes('/api/')) {
        addEntry({
          type: 'request',
          endpoint: url,
          data: init?.body ? JSON.parse(init.body as string) : null,
        });
      }

      try {
        const response = await originalFetch(input, init);
        
        if (url.includes('/api/')) {
          // Clone response to read body
          const cloned = response.clone();
          try {
            const data = await cloned.json();
            addEntry({
              type: response.ok ? 'response' : 'error',
              endpoint: url,
              data,
            });
          } catch {
            // Response wasn't JSON
          }
        }
        
        return response;
      } catch (error) {
        if (url.includes('/api/')) {
          addEntry({
            type: 'error',
            endpoint: url,
            data: { error: String(error) },
          });
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [addEntry]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 text-gray-100 shadow-xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
        <h2 className="text-lg font-semibold">Debug Panel</h2>
        <div className="flex gap-2">
          <button
            onClick={() => void fetchDebugData()}
            disabled={loading}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Session Memory Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('memory')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800"
          >
            <span className="font-medium">Session Memory ({sessionMemory.length})</span>
            {expandedSections.memory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.memory && (
            <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
              {sessionMemory.length === 0 ? (
                <p className="text-gray-500 text-sm p-2">No memory entries (plan not created)</p>
              ) : (
                sessionMemory.map((mem, i) => (
                  <div key={i} className="bg-gray-800 rounded p-2 text-xs">
                    <div className="text-blue-400 font-mono">{mem.memory_key}</div>
                    <pre className="text-gray-300 mt-1 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(mem.memory_value, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Session Messages Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('messages')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800"
          >
            <span className="font-medium">Session Messages ({sessionMessages.length})</span>
            {expandedSections.messages ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.messages && (
            <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
              {sessionMessages.map((msg, i) => (
                <div key={i} className={`rounded p-2 text-xs ${
                  msg.role === 'user' ? 'bg-blue-900' :
                  msg.role === 'tool' ? 'bg-purple-900' : 'bg-gray-800'
                }`}>
                  <div className="flex justify-between">
                    <span className="font-medium">{msg.role}</span>
                    <span className="text-gray-500">Step {msg.step_number}</span>
                  </div>
                  {msg.tool_name && (
                    <div className="text-yellow-400 mt-1">Tool: {msg.tool_name}</div>
                  )}
                  <div className="text-gray-300 mt-1 truncate">{msg.content?.slice(0, 100)}...</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Requests Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('requests')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800"
          >
            <span className="font-medium">API Requests ({entries.length})</span>
            {expandedSections.requests ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.requests && (
            <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
              {entries.map((entry, i) => (
                <div key={i} className={`rounded p-2 text-xs ${
                  entry.type === 'error' ? 'bg-red-900' :
                  entry.type === 'request' ? 'bg-blue-900' :
                  entry.type === 'response' ? 'bg-green-900' : 'bg-gray-800'
                }`}>
                  <div className="flex justify-between">
                    <span className={`font-medium ${
                      entry.type === 'error' ? 'text-red-400' :
                      entry.type === 'request' ? 'text-blue-400' : 'text-green-400'
                    }`}>
                      {entry.type.toUpperCase()}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-gray-400 font-mono truncate">{entry.endpoint}</div>
                  {entry.data !== null && entry.data !== undefined && (
                    <pre className="text-gray-300 mt-1 overflow-x-auto max-h-32 whitespace-pre-wrap">
                      {JSON.stringify(entry.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
              {entries.length === 0 && (
                <p className="text-gray-500 text-sm p-2">No requests captured yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-700 bg-gray-800 text-xs text-gray-500">
        Session: {sessionId?.slice(0, 8) || 'None'}...
      </div>
    </div>
  );
};
