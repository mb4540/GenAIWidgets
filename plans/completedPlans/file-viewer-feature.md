# File Viewer Feature Plan

## Overview
Enhance the File Storage widget with in-app file viewing capabilities. Users will be able to preview files directly in the application without downloading them.

**Note**: Implementation uses native browser capabilities + `mammoth` (DOCX) + `xlsx` (spreadsheets) instead of `react-file-viewer-extended`.

## Supported Formats (Implemented)
- **Images**: PNG, JPG, GIF, BMP, WebP ✅
- **Documents**: PDF, DOCX, XLSX/XLS, CSV ✅
- **Media**: Video (MP4, WebM), Audio (MP3, WAV) ✅
- **Text**: TXT, JSON, HTML ✅
- **Unsupported**: PPTX (shows download prompt)

## Implementation Plan

### Phase 1: Dependencies & Setup ✅ COMPLETED
- [x] Install dependencies
  - Using `mammoth` for DOCX rendering
  - Using `xlsx` for spreadsheet rendering
  - Native browser for images, video, audio, PDF
- [x] Verify compatibility with Vite/React 18

### Phase 2: File Viewer Component ✅ COMPLETED
- [x] Create `FileViewerModal.tsx` component
  - Modal overlay with close button ✅
  - Responsive sizing (90vw x 90vh, max-w-6xl) ✅
  - Loading state while file loads ✅
  - Error handling for unsupported formats ✅
  - Keyboard support (Escape to close) ✅
- [x] Custom viewers implemented:
  - `TextFileViewer` - for text/plain, JSON, HTML
  - `DocxViewer` - uses mammoth for Word docs
  - `XlsxViewer` - uses xlsx with sheet tabs

### Phase 3: Backend - Blob URL Generation ✅ COMPLETED
- [x] `files-download.ts` returns blob data
  - Fetched via `/api/files/download?id={fileId}`
  - Converted to Blob URL client-side
  - URL revoked on modal close (memory cleanup)

### Phase 4: FilesPage UI Enhancement ✅ COMPLETED
- [x] Add "View" button/icon to file list items
  - Eye icon in `FileItem.tsx`
- [x] Integrate FileViewerModal
  - Imported and used in `FilesPage.tsx`
- [x] Show file type indicator for viewable files
  - `isViewableFile()` helper function
- [x] Disable view option for unsupported formats
  - View button only shown when `isViewableFile()` returns true

### Phase 5: Viewer UI Features ✅ COMPLETED
- [x] Toolbar with:
  - Close button (X icon) ✅
  - Download button ✅
  - File name display ✅
  - Fullscreen toggle (Maximize2/Minimize2 icons) ✅
- [ ] Zoom controls (for images/PDFs) - NOT IMPLEMENTED
- [x] Navigation for multi-page documents
  - PDF uses native browser iframe (has built-in nav)
  - XLSX has sheet tabs for multi-sheet navigation

## Technical Details

### FileViewerModal Props
```typescript
interface FileViewerModalProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
}
```

### File Type Detection
Map MIME types to react-file-viewer-extended types:
```typescript
const mimeToViewerType: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
};
```

### Blob URL Flow
1. User clicks "View" on a file
2. Frontend fetches file via `/api/files/download?id={fileId}&preview=true`
3. Response is converted to Blob URL
4. Blob URL passed to FileViewer component
5. URL revoked on modal close to prevent memory leaks

## UI Mockup

```
┌─────────────────────────────────────────────────────────┐
│  ╳  document.pdf                        ⤓ Download      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│                   [File Preview Area]                   │
│                                                         │
│                                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ◀ Page 1 of 5 ▶                    🔍- 100% 🔍+        │
└─────────────────────────────────────────────────────────┘
```

## Files Created/Modified ✅

### New Files
- `src/components/files/FileViewerModal.tsx` - Modal viewer component (414 lines) ✅

### Modified Files
- `src/pages/files/FilesPage.tsx` - Integrated FileViewerModal ✅
- `src/pages/files/components/FileItem.tsx` - Added view button ✅
- `package.json` - Added `mammoth` and `xlsx` dependencies ✅

## Testing
- [ ] Unit tests for FileViewerModal component (in ToDos.md - 27% coverage)
- [x] Test each supported file type - manual testing done
- [x] Test unsupported file type handling - shows download prompt
- [x] Test modal keyboard navigation - Escape to close
- [x] Test memory cleanup (blob URL revocation) - implemented in useEffect cleanup

## Considerations (Addressed)
- **Memory**: ✅ Blob URLs revoked in useEffect cleanup
- **Large Files**: Not yet implemented (no size limit)
- **Fallback**: ✅ Download option shown for unsupported formats
- **Mobile**: ✅ Responsive design with 90vw/90vh sizing

## Remaining Work
- [ ] Add zoom controls for images/PDFs
- [ ] Add unit tests for FileViewerModal (currently 27% coverage)
- [ ] Consider file size limits for preview

## Status: ~95% COMPLETE
