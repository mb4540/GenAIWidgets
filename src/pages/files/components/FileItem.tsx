import React from 'react';
import { Eye, Download, Trash2 } from 'lucide-react';
import ExtractionStatus from './ExtractionStatus';
import { isViewableFile } from '@/components/files/FileViewerModal';

interface FileItemData {
  id: string;
  name: string;
  path: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
  updatedAt: string;
  extractionStatus?: 'pending' | 'processing' | 'extracted' | 'failed' | null;
  chunkCount?: number | null;
  tenantId?: string;
  tenantName?: string;
}

interface FileItemProps {
  file: FileItemData;
  extractingFileId: string | null;
  onView: (file: FileItemData) => void;
  onDownload: (fileId: string, fileName: string) => void;
  onDelete: (fileId: string) => void;
  onExtract: (fileId: string) => void;
  onViewChunks: (fileId: string) => void;
  getFileIcon: (mimeType: string | null) => string;
  formatFileSize: (bytes: number | null) => string;
  showTenantInfo?: boolean;
}

export default function FileItem({
  file,
  extractingFileId,
  onView,
  onDownload,
  onDelete,
  onExtract,
  onViewChunks,
  getFileIcon,
  formatFileSize,
  showTenantInfo,
}: FileItemProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 flex-1">
        <span className="text-xl">{getFileIcon(file.mimeType)}</span>
        <div>
          <div className="font-medium">{file.name}</div>
          <div className="text-xs text-muted-foreground">
            {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
            {showTenantInfo && file.tenantName && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {file.tenantName}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <ExtractionStatus
          status={file.extractionStatus}
          chunkCount={file.chunkCount}
          isExtracting={extractingFileId === file.id}
          onExtract={() => onExtract(file.id)}
          onViewChunks={() => onViewChunks(file.id)}
        />
        {isViewableFile(file.mimeType) && (
          <button
            onClick={() => onView(file)}
            className="p-2 text-muted-foreground hover:text-primary"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDownload(file.id, file.name)}
          className="p-2 text-muted-foreground hover:text-primary"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(file.id)}
          className="p-2 text-muted-foreground hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export type { FileItemData };
