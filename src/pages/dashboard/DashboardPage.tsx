import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  LayoutDashboard, 
  FileText, 
  FolderOpen, 
  Layers, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2,
  MessageSquare,
  Sparkles,
  Info,
  Bot,
  Wrench
} from 'lucide-react';
import PageInfoModal from '@/components/common/PageInfoModal';
import { dashboardInfo } from './dashboardInfo';

interface FileStats {
  totalFiles: number;
  totalFolders: number;
}

interface ExtractionStats {
  pending: number;
  processing: number;
  extracted: number;
  failed: number;
  totalChunks: number;
}

interface QAStats {
  totalPairs: number;
  pending: number;
  approved: number;
  rejected: number;
  totalJobs: number;
}

interface AiChatStats {
  totalSessions: number;
  activeSessions: number;
}

interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  totalSessions: number;
  totalTools: number;
}

interface RecentActivity {
  type: 'extraction' | 'qa_generation';
  fileName: string;
  status: string;
  timestamp: string;
}

interface DashboardData {
  fileStats: FileStats;
  extractionStats: ExtractionStats;
  qaStats: QAStats;
  aiChatStats: AiChatStats;
  agentStats: AgentStats;
  recentActivity: RecentActivity[];
}

export default function DashboardPage() {
  const { user, tenant } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats', {
          headers: getAuthHeaders(),
        });
        const result = await response.json() as { success: boolean; error?: string } & DashboardData;
        if (result.success) {
          setData({
            fileStats: result.fileStats,
            extractionStats: result.extractionStats,
            qaStats: result.qaStats,
            aiChatStats: result.aiChatStats,
            agentStats: result.agentStats,
            recentActivity: result.recentActivity,
          });
        } else {
          setError(result.error || 'Failed to load dashboard');
        }
      } catch {
        setError('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    void fetchStats();
  }, [getAuthHeaders]);

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'extracted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" />
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        </div>
        <button
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="View technical documentation"
        >
          <Info className="h-4 w-4" />
          <span>Details</span>
        </button>
      </div>

      <PageInfoModal
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        content={dashboardInfo}
      />

      {/* Welcome Card */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-muted-foreground">
          Welcome back, <strong className="text-foreground">{user?.fullName}</strong>
          {tenant && (
            <span> · {tenant.name} ({tenant.role})</span>
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Files Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">Files</span>
              </div>
              <div className="text-3xl font-bold">{data.fileStats.totalFiles}</div>
              <div className="text-sm text-muted-foreground mt-1">
                <FolderOpen className="h-3 w-3 inline mr-1" />
                {data.fileStats.totalFolders} folders
              </div>
            </div>

            {/* Extraction Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Layers className="h-4 w-4" />
                <span className="text-sm font-medium">Extractions</span>
              </div>
              <div className="text-3xl font-bold">{data.extractionStats.extracted}</div>
              <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                <span className="text-yellow-600">{data.extractionStats.pending} pending</span>
                <span className="text-red-600">{data.extractionStats.failed} failed</span>
              </div>
            </div>

            {/* Chunks Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">Chunks</span>
              </div>
              <div className="text-3xl font-bold">{data.extractionStats.totalChunks}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Total extracted
              </div>
            </div>

            {/* Q&A Pairs Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MessageSquare className="h-4 w-4" />
                <span className="text-sm font-medium">Q&A Pairs</span>
              </div>
              <div className="text-3xl font-bold">{data.qaStats.totalPairs}</div>
              <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                <span className="text-green-600">{data.qaStats.approved} approved</span>
                <span className="text-yellow-600">{data.qaStats.pending} pending</span>
              </div>
            </div>
          </div>

          {/* Second Row - AI & Agent Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* AI Chat Sessions Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MessageSquare className="h-4 w-4" />
                <span className="text-sm font-medium">AI Chat Sessions</span>
              </div>
              <div className="text-3xl font-bold">{data.aiChatStats.totalSessions}</div>
              <div className="text-sm text-muted-foreground mt-1">
                <span className="text-green-600">{data.aiChatStats.activeSessions} active</span>
              </div>
            </div>

            {/* Agents Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Bot className="h-4 w-4" />
                <span className="text-sm font-medium">Agents</span>
              </div>
              <div className="text-3xl font-bold">{data.agentStats.totalAgents}</div>
              <div className="text-sm text-muted-foreground mt-1">
                <span className="text-green-600">{data.agentStats.activeAgents} active</span>
              </div>
            </div>

            {/* Agent Sessions Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Bot className="h-4 w-4" />
                <span className="text-sm font-medium">Agent Sessions</span>
              </div>
              <div className="text-3xl font-bold">{data.agentStats.totalSessions}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Total conversations
              </div>
            </div>

            {/* Tools Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Wrench className="h-4 w-4" />
                <span className="text-sm font-medium">Agent Tools</span>
              </div>
              <div className="text-3xl font-bold">{data.agentStats.totalTools}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Available tools
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-lg border border-border bg-card">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
            </div>
            <div className="divide-y divide-border">
              {data.recentActivity.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No recent activity
                </div>
              ) : (
                data.recentActivity.map((activity, index) => (
                  <div key={index} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(activity.status)}
                      <div>
                        <div className="font-medium text-sm">{activity.fileName}</div>
                        <div className="text-xs text-muted-foreground">
                          {activity.type === 'extraction' ? 'Extraction' : 'Q&A Generation'} · {activity.status}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTimeAgo(activity.timestamp)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
