import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Folder, File, Upload, FolderPlus } from 'lucide-react';
import FileViewerModal from '@/components/files/FileViewerModal';
import { ExtractionPreviewModal, type ExtractedContent } from '../rag/components';
import {
  FilesBreadcrumb,
  FileItem,
  FolderItem,
  CreateFolderForm,
  type FileItemData,
  type FolderItemData,
} from './components';

interface FilesResponse {
  success: boolean;
  path: string;
  tenantId: string;
  totalFileCount: number;
  files: FileItemData[];
  folders: FolderItemData[];
  error?: string;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null): string {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
  return '📄';
}

export default function FilesPage(): React.ReactElement {
  const { user } = useAuth();
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileItemData[]>([]);
  const [folders, setFolders] = useState<FolderItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFileCount, setTotalFileCount] = useState(0);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewingFile, setViewingFile] = useState<FileItemData | null>(null);
  const [extractingFileId, setExtractingFileId] = useState<string | null>(null);
  const [viewingChunksFile, setViewingChunksFile] = useState<FileItemData | null>(null);
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [showAllTenants, setShowAllTenants] = useState(false);

  const fetchFiles = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const url = showAllTenants 
        ? `/api/files/list?allTenants=true`
        : `/api/files/list?path=${encodeURIComponent(currentPath)}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as FilesResponse;
      if (data.success) {
        setFiles(data.files);
        setFolders(data.folders);
        setTotalFileCount(data.totalFileCount || 0);
      } else {
        setError(data.error || 'Failed to load files');
      }
    } catch {
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [currentPath, showAllTenants]);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const handleCreateFolder = async (folderName: string): Promise<void> => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/folders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: folderName, parentPath: currentPath }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) {
        setShowCreateFolder(false);
        void fetchFiles();
      } else {
        setError(data.error || 'Failed to create folder');
      }
    } catch {
      setError('Failed to create folder');
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', currentPath);
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) {
        void fetchFiles();
      } else {
        setError(data.error || 'Failed to upload file');
      }
    } catch {
      setError('Failed to upload file');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteFile = async (fileId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/files/delete?id=${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) {
        void fetchFiles();
      } else {
        setError(data.error || 'Failed to delete file');
      }
    } catch {
      setError('Failed to delete file');
    }
  };

  const handleExtract = async (fileId: string): Promise<void> => {
    setExtractingFileId(fileId);
    try {
      const token = localStorage.getItem('auth_token');
      const triggerResponse = await fetch('/api/extraction/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ blobId: fileId }),
      });
      const triggerData = (await triggerResponse.json()) as { success: boolean; error?: string };
      if (!triggerData.success) {
        setError(triggerData.error || 'Failed to trigger extraction');
        setExtractingFileId(null);
        return;
      }
      
      // Extraction started in background - poll for completion
      void fetchFiles();
      
      // Poll every 3 seconds for up to 5 minutes
      const pollInterval = setInterval(async () => {
        await fetchFiles();
        const updatedFiles = files.find(f => f.id === fileId);
        if (updatedFiles?.extractionStatus === 'extracted' || updatedFiles?.extractionStatus === 'failed') {
          clearInterval(pollInterval);
          setExtractingFileId(null);
        }
      }, 3000);
      
      // Stop polling after 5 minutes max
      setTimeout(() => {
        clearInterval(pollInterval);
        setExtractingFileId(null);
      }, 5 * 60 * 1000);
      
    } catch {
      setError('Failed to extract file');
      setExtractingFileId(null);
    }
  };

  const handleDeleteFolder = async (folderId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this folder and all its contents?')) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/folders/delete?id=${folderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) {
        void fetchFiles();
      } else {
        setError(data.error || 'Failed to delete folder');
      }
    } catch {
      setError('Failed to delete folder');
    }
  };

  const handleDownload = (fileId: string, fileName: string): void => {
    const token = localStorage.getItem('auth_token');
    fetch(`/api/files/download?id=${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(() => setError('Failed to download file'));
  };

  const navigateToParent = (): void => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length > 0 ? '/' + parts.join('/') : '/');
  };

  const handleViewChunks = async (fileId: string): Promise<void> => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    
    setViewingChunksFile(file);
    setLoadingChunks(true);
    setExtractedContent(null);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/extraction/content?fileId=${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json() as { success: boolean; content?: ExtractedContent; error?: string };
      if (data.success && data.content) {
        setExtractedContent(data.content);
      } else {
        setError(data.error || 'Failed to load extracted content');
        setViewingChunksFile(null);
      }
    } catch {
      setError('Failed to load extracted content');
      setViewingChunksFile(null);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleCloseChunksModal = (): void => {
    setViewingChunksFile(null);
    setExtractedContent(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">File Storage</h1>
        <p className="text-muted-foreground">
          Manage your files and folders
          {user?.isAdmin && (
            <button
              onClick={() => setShowAllTenants(!showAllTenants)}
              className={`ml-2 text-xs px-2 py-0.5 rounded transition-colors ${
                showAllTenants 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              {showAllTenants ? 'All Tenants' : 'Admin'}
            </button>
          )}
          {totalFileCount > 0 && (
            <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">
              {totalFileCount} {totalFileCount === 1 ? 'file' : 'files'} total
            </span>
          )}
        </p>
      </div>

      <div className="flex justify-between items-center">
        <FilesBreadcrumb currentPath={currentPath} onNavigate={setCurrentPath} />
        <div className="flex gap-2">
          <label className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm cursor-pointer hover:bg-primary/90">
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload'}
            <input type="file" className="hidden" onChange={(e) => void handleUpload(e)} disabled={uploading} />
          </label>
          <button
            onClick={() => setShowCreateFolder(true)}
            className="flex items-center gap-2 border border-border px-4 py-2 rounded-md text-sm hover:bg-muted"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-destructive flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-sm underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {currentPath !== '/' && (
            <button
              onClick={navigateToParent}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/50 border-b border-border text-left"
            >
              <Folder className="h-5 w-5 text-muted-foreground" />
              <span className="text-muted-foreground">..</span>
            </button>
          )}

          {showCreateFolder && (
            <CreateFolderForm
              onCreateFolder={handleCreateFolder}
              onCancel={() => setShowCreateFolder(false)}
            />
          )}

          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              onNavigate={setCurrentPath}
              onDelete={(id) => void handleDeleteFolder(id)}
            />
          ))}

          {files.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              extractingFileId={extractingFileId}
              onView={setViewingFile}
              onDownload={handleDownload}
              onDelete={(id) => void handleDeleteFile(id)}
              onExtract={(id) => void handleExtract(id)}
              onViewChunks={(id) => void handleViewChunks(id)}
              getFileIcon={getFileIcon}
              formatFileSize={formatFileSize}
              showTenantInfo={showAllTenants}
            />
          ))}

          {folders.length === 0 && files.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>This folder is empty</p>
              <p className="text-sm mt-1">Upload files or create folders to get started</p>
            </div>
          )}
        </div>
      )}

      <FileViewerModal
        file={viewingFile}
        isOpen={viewingFile !== null}
        onClose={() => setViewingFile(null)}
      />

      <ExtractionPreviewModal
        isOpen={viewingChunksFile !== null}
        onClose={handleCloseChunksModal}
        extractedContent={extractedContent}
        fileName={viewingChunksFile?.name || ''}
        loading={loadingChunks}
      />
    </div>
  );
}
