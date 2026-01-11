import { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, FileText } from 'lucide-react';

interface ExtractedContent {
  title?: string;
  language?: string;
  pages?: Array<{
    pageNumber: number;
    text: string;
    headings?: string[];
  }>;
  fullText?: string;
}

interface ExtractionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (content: string) => void;
  extractedContent: ExtractedContent | null;
  fileName: string;
  warning?: string;
}

function formatExtractedContent(content: ExtractedContent): string {
  let formatted = '';
  
  if (content.title) {
    formatted += `# ${content.title}\n\n`;
  }
  
  if (content.pages && content.pages.length > 0) {
    for (const page of content.pages) {
      if (page.headings && page.headings.length > 0) {
        formatted += `## ${page.headings.join(' > ')}\n\n`;
      }
      formatted += `${page.text}\n\n`;
      if (content.pages.length > 1) {
        formatted += `--- Page ${page.pageNumber} ---\n\n`;
      }
    }
  } else if (content.fullText) {
    formatted += content.fullText;
  }
  
  return formatted.trim();
}

export default function ExtractionPreviewModal({
  isOpen,
  onClose,
  onAccept,
  extractedContent,
  fileName,
  warning,
}: ExtractionPreviewModalProps): React.ReactElement | null {
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    if (extractedContent) {
      setEditedText(formatExtractedContent(extractedContent));
    }
  }, [extractedContent]);

  if (!isOpen || !extractedContent) return null;

  const pageCount = extractedContent.pages?.length || 1;
  const charCount = editedText.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Review Extracted Content</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Warning */}
          {warning && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500 bg-yellow-50 text-yellow-900">
              <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
              <span className="text-sm">{warning}</span>
            </div>
          )}

          {/* File Info */}
          <div className="bg-muted/50 p-3 rounded-md">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">File:</span>
                <span className="ml-2 font-medium">{fileName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Pages:</span>
                <span className="ml-2 font-medium">{pageCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Characters:</span>
                <span className="ml-2 font-medium">{charCount.toLocaleString()}</span>
              </div>
            </div>
            {extractedContent.title && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">Title:</span>
                <span className="ml-2 font-medium">{extractedContent.title}</span>
              </div>
            )}
          </div>

          {/* Editable Content */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Extracted Content
              <span className="text-muted-foreground font-normal ml-2">
                (review and edit if needed)
              </span>
            </label>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={16}
              className="w-full p-3 border border-border rounded-md bg-background font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              This content will be chunked and stored for retrieval. 
              Make any corrections before accepting.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onAccept(editedText)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Check className="h-4 w-4" />
            Accept & Save
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ExtractedContent, ExtractionPreviewModalProps };
