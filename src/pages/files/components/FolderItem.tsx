import React from 'react';
import { Folder, Trash2 } from 'lucide-react';

interface FolderItemData {
  id: string;
  name: string;
  path: string;
  createdAt: string;
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
        <span className="font-medium">{folder.name}</span>
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
