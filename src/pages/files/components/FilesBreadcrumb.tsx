import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface FilesBreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export default function FilesBreadcrumb({
  currentPath,
  onNavigate,
}: FilesBreadcrumbProps): React.ReactElement {
  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        onClick={() => onNavigate('/')}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <Home className="h-4 w-4" />
        Home
      </button>
      {pathParts.map((part, index) => {
        const pathToHere = '/' + pathParts.slice(0, index + 1).join('/');
        return (
          <React.Fragment key={pathToHere}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button
              onClick={() => onNavigate(pathToHere)}
              className="text-muted-foreground hover:text-foreground"
            >
              {part}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
