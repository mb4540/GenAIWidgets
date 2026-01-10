import React, { useEffect, useState, useCallback } from 'react';
import DocViewer, { DocViewerRenderers } from '@cyntler/react-doc-viewer';
import '@cyntler/react-doc-viewer/dist/index.css';
import { X, Download, Maximize2, Minimize2 } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  path: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
  updatedAt: string;
}

interface FileViewerModalProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const VIEWABLE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/bmp',
  'image/webp',
  'text/plain',
  'text/csv',
  'text/html',
  'application/json',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
];

export function isViewableFile(mimeType: string | null): boolean {
  if (!mimeType) return false;
  const category = mimeType.split('/')[0];
  if (!category) return false;
  return VIEWABLE_TYPES.some(type => mimeType.startsWith(category) || mimeType === type);
}

export default function FileViewerModal({ file, isOpen, onClose }: FileViewerModalProps): React.ReactElement | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchFileBlob = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/files/download?id=${file.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load file');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  }, [file]);

  useEffect(() => {
    if (isOpen && file) {
      fetchFileBlob();
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
    };
  }, [isOpen, file, fetchFileBlob]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDownload = async () => {
    if (!file) return;

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`/api/files/download?id=${file.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (!isOpen || !file) return null;

  const isImage = file.mimeType?.startsWith('image/');
  const isVideo = file.mimeType?.startsWith('video/');
  const isAudio = file.mimeType?.startsWith('audio/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className={`bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-[90vw] h-[90vh] max-w-6xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
              {file.name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-800">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <button
                  onClick={fetchFileBlob}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && blobUrl && (
            <>
              {isImage && (
                <div className="flex items-center justify-center h-full">
                  <img
                    src={blobUrl}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}

              {isVideo && (
                <div className="flex items-center justify-center h-full">
                  <video
                    src={blobUrl}
                    controls
                    className="max-w-full max-h-full"
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              )}

              {isAudio && (
                <div className="flex items-center justify-center h-full">
                  <audio src={blobUrl} controls className="w-full max-w-md">
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {!isImage && !isVideo && !isAudio && (
                <DocViewer
                  documents={[{ uri: blobUrl, fileName: file.name }]}
                  pluginRenderers={DocViewerRenderers}
                  config={{
                    header: {
                      disableHeader: true,
                      disableFileName: true,
                    },
                  }}
                  style={{ height: '100%' }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
