import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Folder, File, Upload, FolderPlus, Trash2, Download, ChevronRight, Home, Eye, Sparkles, Clock, Check, X, Loader2 } from 'lucide-react';
import FileViewerModal, { isViewableFile } from '@/components/files/FileViewerModal';

interface FileItem {
  id: string;
  name: string;
  path: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
  updatedAt: string;
  extractionStatus?: 'pending' | 'processing' | 'extracted' | 'failed' | null;
  chunkCount?: number | null;
}

interface FolderItem {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

interface FilesResponse {
  success: boolean;
  path: string;
  tenantId: string;
  files: FileItem[];
  folders: FolderItem[];
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
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [viewingFile, setViewingFile] = useState<FileItem | null>(null);
  const [extractingFileId, setExtractingFileId] = useState<string | null>(null);

  const fetchFiles = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/files/list?path=${encodeURIComponent(currentPath)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await response.json()) as FilesResponse;

      if (data.success) {
        setFiles(data.files);
        setFolders(data.folders);
      } else {
        setError(data.error || 'Failed to load files');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const navigateToFolder = (path: string): void => {
    setCurrentPath(path);
  };

  const navigateUp = (): void => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length === 0 ? '/' : `/${parts.join('/')}/`);
  };

  const getBreadcrumbs = (): { name: string; path: string }[] => {
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Home', path: '/' }];
    let path = '/';
    for (const part of parts) {
      path += `${part}/`;
      breadcrumbs.push({ name: part, path });
    }
    return breadcrumbs;
  };

  const handleCreateFolder = async (): Promise<void> => {
    if (!newFolderName.trim()) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/folders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newFolderName,
          parentPath: currentPath,
        }),
      });

      const data = (await response.json()) as { success: boolean; error?: string };

      if (data.success) {
        setNewFolderName('');
        setShowCreateFolder(false);
        void fetchFiles();
      } else {
        setError(data.error || 'Failed to create folder');
      }
    } catch {
      setError('Failed to create folder');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
        return;
      }

      const workerResponse = await fetch('/api/extraction/worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ processNext: true }),
      });

      const workerData = (await workerResponse.json()) as { success: boolean; error?: string };
      if (!workerData.success) {
        setError(workerData.error || 'Extraction failed');
      }

      void fetchFiles();
    } catch {
      setError('Failed to extract file');
    } finally {
      setExtractingFileId(null);
    }
  };

  const handleDeleteFolder = async (folderId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this folder and all its contents?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/folders/delete?id=${folderId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    const url = `/api/files/download?id=${fileId}`;
    
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => response.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      })
      .catch(() => {
        setError('Failed to download file');
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">File Storage</h1>
          <p className="text-muted-foreground">
            Manage your files and folders
            {user?.isAdmin && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Admin</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer">
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload'}
            <input
              type="file"
              className="hidden"
              onChange={(e) => void handleFileUpload(e)}
              disabled={uploading}
            />
          </label>
          <button
            onClick={() => setShowCreateFolder(true)}
            className="flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1 text-sm">
        {getBreadcrumbs().map((crumb, index, arr) => (
          <div key={crumb.path} className="flex items-center">
            <button
              onClick={() => navigateToFolder(crumb.path)}
              className={`flex items-center gap-1 hover:text-primary ${
                index === arr.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              {index === 0 && <Home className="h-4 w-4" />}
              {crumb.name}
            </button>
            {index < arr.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
          </div>
        ))}
      </nav>

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Create New Folder</h2>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateFolder(false);
                  setNewFolderName('');
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateFolder()}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          {/* Back Button */}
          {currentPath !== '/' && (
            <button
              onClick={navigateUp}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 border-b border-border text-left"
            >
              <Folder className="h-5 w-5 text-muted-foreground" />
              <span className="text-muted-foreground">..</span>
            </button>
          )}

          {/* Folders */}
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 border-b border-border last:border-b-0"
            >
              <button
                onClick={() => navigateToFolder(folder.path)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <Folder className="h-5 w-5 text-blue-500" />
                <span className="font-medium">{folder.name}</span>
              </button>
              <button
                onClick={() => void handleDeleteFolder(folder.id)}
                className="p-2 text-muted-foreground hover:text-destructive"
                title="Delete folder"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Files */}
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 border-b border-border last:border-b-0"
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xl">{getFileIcon(file.mimeType)}</span>
                <div>
                  <div className="font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Extraction Status/Button */}
                {extractingFileId === file.id ? (
                  <span className="p-2 text-blue-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </span>
                ) : file.extractionStatus === 'extracted' ? (
                  <span className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-50 rounded" title={`${file.chunkCount || 0} chunks extracted`}>
                    <Check className="h-3 w-3" />
                    {file.chunkCount || 0}
                  </span>
                ) : file.extractionStatus === 'processing' ? (
                  <span className="p-2 text-blue-500" title="Processing">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </span>
                ) : file.extractionStatus === 'pending' ? (
                  <span className="p-2 text-yellow-500" title="Pending extraction">
                    <Clock className="h-4 w-4" />
                  </span>
                ) : file.extractionStatus === 'failed' ? (
                  <button
                    onClick={() => void handleExtract(file.id)}
                    className="p-2 text-red-500 hover:text-red-600"
                    title="Extraction failed - click to retry"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => void handleExtract(file.id)}
                    className="p-2 text-muted-foreground hover:text-primary"
                    title="Extract for RAG"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                )}
                {isViewableFile(file.mimeType) && (
                  <button
                    onClick={() => setViewingFile(file)}
                    className="p-2 text-muted-foreground hover:text-primary"
                    title="View"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDownload(file.id, file.name)}
                  className="p-2 text-muted-foreground hover:text-primary"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => void handleDeleteFile(file.id)}
                  className="p-2 text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {folders.length === 0 && files.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>This folder is empty</p>
              <p className="text-sm mt-1">Upload files or create folders to get started</p>
            </div>
          )}
        </div>
      )}

      {/* File Viewer Modal */}
      <FileViewerModal
        file={viewingFile}
        isOpen={viewingFile !== null}
        onClose={() => setViewingFile(null)}
      />
    </div>
  );
}
