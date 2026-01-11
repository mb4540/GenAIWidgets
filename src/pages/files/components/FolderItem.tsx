import React from 'react';
import { Folder, Trash2 } from 'lucide-react';

interface FolderItemData {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  fileCount?: number;
}

interface FolderItemProps {
  folder: FolderItemData;
  onNavigate: (path: string) => void;
  onDelete: (folderId: string) => void;
}

export default function FolderItem({
  folder,
  onNavigate,
  onDelete,
}: FolderItemProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 border-b border-border">
      <button
        onClick={() => onNavigate(folder.path)}
        className="flex items-center gap-3 flex-1 text-left"
      >
        <Folder className="h-5 w-5 text-blue-500" />
        <div className="flex items-center gap-2">
          <span className="font-medium">{folder.name}</span>
          {folder.fileCount !== undefined && folder.fileCount > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>
      </button>
      <button
        onClick={() => onDelete(folder.id)}
        className="p-2 text-muted-foreground hover:text-destructive"
        title="Delete folder"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export type { FolderItemData };
