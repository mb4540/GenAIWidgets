# File Viewer Feature Plan

## Overview
Enhance the File Storage widget with in-app file viewing capabilities using `react-file-viewer-extended`. Users will be able to preview files directly in the application without downloading them.

## Supported Formats
Based on `react-file-viewer-extended` capabilities:
- **Images**: PNG, JPG, GIF, BMP
- **Documents**: PDF, DOCX, XLSX, CSV
- **Media**: Video (MP4, WebM), Audio (MP3, WAV)

## Implementation Plan

### Phase 1: Dependencies & Setup
- [ ] Install `react-file-viewer-extended` package
- [ ] Verify compatibility with Vite/React 18

### Phase 2: File Viewer Component
- [ ] Create `FileViewerModal.tsx` component
  - Modal overlay with close button
  - Responsive sizing (max 90% viewport)
  - Loading state while file loads
  - Error handling for unsupported formats
  - Keyboard support (Escape to close)

### Phase 3: Backend - Blob URL Generation
- [ ] Modify `files-download.ts` to support preview mode
  - Add `?preview=true` query param option
  - Return blob data suitable for client-side viewing
  - Set appropriate CORS headers for blob URLs

### Phase 4: FilesPage UI Enhancement
- [ ] Add "View" button/icon to file list items
- [ ] Add click-to-preview on file name
- [ ] Integrate FileViewerModal
- [ ] Show file type indicator for viewable files
- [ ] Disable view option for unsupported formats

### Phase 5: Viewer UI Features
- [ ] Toolbar with:
  - Close button
  - Download button
  - File name display
  - Zoom controls (for images/PDFs)
- [ ] Navigation for multi-page documents (PDF)
- [ ] Fullscreen toggle

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

## Files to Create/Modify

### New Files
- `src/components/files/FileViewerModal.tsx` - Modal viewer component

### Modified Files
- `src/pages/files/FilesPage.tsx` - Add view button and modal integration
- `netlify/functions/files-download.ts` - Support preview mode (if needed)
- `package.json` - Add react-file-viewer-extended dependency

## Testing
- [ ] Unit tests for FileViewerModal component
- [ ] Test each supported file type
- [ ] Test unsupported file type handling
- [ ] Test modal keyboard navigation
- [ ] Test memory cleanup (blob URL revocation)

## Considerations
- **Memory**: Revoke blob URLs after use to prevent memory leaks
- **Large Files**: Consider file size limits for preview (e.g., 50MB max)
- **Fallback**: Show download option for unsupported formats
- **Mobile**: Ensure responsive design for mobile viewing

## Estimated Effort
- Phase 1: 15 min
- Phase 2: 1 hour
- Phase 3: 30 min
- Phase 4: 45 min
- Phase 5: 45 min
- Testing: 30 min

**Total: ~4 hours**
