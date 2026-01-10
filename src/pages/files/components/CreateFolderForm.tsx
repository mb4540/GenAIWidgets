import React, { useState } from 'react';

interface CreateFolderFormProps {
  onCreateFolder: (name: string) => Promise<void>;
  onCancel: () => void;
}

export default function CreateFolderForm({
  onCreateFolder,
  onCancel,
}: CreateFolderFormProps): React.ReactElement {
  const [folderName, setFolderName] = useState('');

  const handleSubmit = async (): Promise<void> => {
    if (!folderName.trim()) return;
    await onCreateFolder(folderName);
    setFolderName('');
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
      <input
        type="text"
        value={folderName}
        onChange={(e) => setFolderName(e.target.value)}
        placeholder="Folder name"
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button
        onClick={() => void handleSubmit()}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm"
      >
        Create
      </button>
      <button
        onClick={onCancel}
        className="text-muted-foreground px-4 py-2 text-sm"
      >
        Cancel
      </button>
    </div>
  );
}
