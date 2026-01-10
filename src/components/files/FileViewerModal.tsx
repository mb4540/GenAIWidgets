import React, { useEffect, useState, useCallback } from 'react';
import { X, Download, Maximize2, Minimize2 } from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

function TextFileViewer({ blobUrl }: { blobUrl: string }): React.ReactElement {
  const [content, setContent] = useState<string>('Loading...');

  useEffect(() => {
    fetch(blobUrl)
      .then(res => res.text())
      .then(text => setContent(text))
      .catch(() => setContent('Failed to load file content'));
  }, [blobUrl]);

  return (
    <pre className="w-full h-full overflow-auto p-4 bg-gray-900 text-gray-100 text-sm font-mono rounded">
      {content}
    </pre>
  );
}

function DocxViewer({ blobUrl }: { blobUrl: string }): React.ReactElement {
  const [html, setHtml] = useState<string>('<p>Loading document...</p>');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(blobUrl)
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => mammoth.convertToHtml({ arrayBuffer }))
      .then(result => {
        setHtml(result.value);
      })
      .catch(() => setError('Failed to load document'));
  }, [blobUrl]);

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>;
  }

  return (
    <div 
      className="w-full h-full overflow-auto p-6 bg-white prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function XlsxViewer({ blobUrl }: { blobUrl: string }): React.ReactElement {
  const [sheets, setSheets] = useState<{ name: string; data: string[][] }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(blobUrl)
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const parsedSheets = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name];
          const data = sheet ? XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) : [];
          return { name, data };
        });
        setSheets(parsedSheets);
      })
      .catch(() => setError('Failed to load spreadsheet'));
  }, [blobUrl]);

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>;
  }

  if (sheets.length === 0) {
    return <div className="text-center p-4">Loading spreadsheet...</div>;
  }

  const currentSheet = sheets[activeSheet];

  return (
    <div className="w-full h-full flex flex-col">
      {sheets.length > 1 && (
        <div className="flex gap-1 p-2 bg-gray-100 dark:bg-gray-700 border-b overflow-x-auto">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(index)}
              className={`px-3 py-1 text-sm rounded whitespace-nowrap ${
                index === activeSheet
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {currentSheet?.data.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex === 0 ? 'bg-gray-200 dark:bg-gray-600 font-semibold' : ''}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border border-gray-300 dark:border-gray-600 px-2 py-1 whitespace-nowrap"
                  >
                    {cell ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
  const isPdf = file.mimeType === 'application/pdf';
  const isText = file.mimeType?.startsWith('text/') || file.mimeType === 'application/json';
  const isDocx = file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                    file.name.toLowerCase().endsWith('.docx');
  const isXlsx = file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.mimeType === 'application/vnd.ms-excel' ||
                    file.name.toLowerCase().endsWith('.xlsx') ||
                    file.name.toLowerCase().endsWith('.xls');
  const isPptx = file.mimeType?.includes('presentation') ||
                    file.mimeType?.includes('powerpoint') ||
                    file.name.toLowerCase().endsWith('.pptx') ||
                    file.name.toLowerCase().endsWith('.ppt');

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

              {isPdf && (
                <iframe
                  src={blobUrl}
                  title={file.name}
                  className="w-full h-full border-0"
                />
              )}

              {isText && (
                <TextFileViewer blobUrl={blobUrl} />
              )}

              {isDocx && (
                <DocxViewer blobUrl={blobUrl} />
              )}

              {isXlsx && (
                <XlsxViewer blobUrl={blobUrl} />
              )}

              {isPptx && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    PowerPoint files cannot be previewed in the browser
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                    Click the download button to view this file
                  </p>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4" />
                    Download {file.name}
                  </button>
                </div>
              )}

              {!isImage && !isVideo && !isAudio && !isPdf && !isText && !isDocx && !isXlsx && !isPptx && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-6xl mb-4">📁</div>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    This file type cannot be previewed
                  </p>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4" />
                    Download {file.name}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
