# ToDos

## UI Changes

- [x] Change "Gemini" header above the dropdown to "Google" on the AI Gateway Chat page

## File Storage Page

- [x] Add a label to the green check + number indicator (shows number of chunks extracted from document)
- [x] Add ability to view the extracted chunks for a document
- [x] Show document count per folder
- [x] Show total document count
- [x] Ensure counts are tenant-sensitive (users see only their tenant's files)
- [x] Admin view: ability to see ALL blob storage files across all tenants
- [x] Admin view: show which tenant each file belongs to
- [x] Improve chunk viewer modal to show individual chunks with boundaries (currently shows merged text)

## File Viewer

- [ ] Add zoom controls for images/PDFs
- [ ] Consider file size limits for preview

## Admin Prompts - Edit Prompt Modal

- [x] Change Model Name from text field to dropdown (like AI Gateway Chat page)
- [x] Create a common/reusable model selector component that can be shared between Edit Prompt modal and AI Gateway Chat page

## RAG Preprocessing

- [x] Add truth set Q&A generator for RAG Preprocessing (core implementation complete)
  - Database tables and migration created
  - Backend APIs: qa-generate, qa-list, qa-update, qa-delete, qa-bulk-approve
  - Frontend: QAGenerateModal, QAReviewModal integrated into RAG Preprocessing page
  - Remaining: Run migration, vectorization integration, polish

## Dashboard Page

- [ ] Update Dashboard with relevant stats based on current system state:
  - Total files uploaded (tenant-scoped)
  - Extraction status summary (pending/processing/extracted/failed counts)
  - Total chunks extracted
  - Recent extraction activity
  - Q&A pairs generated (pending review/approved counts)
  - Token usage overview (if tracked)

## Test Coverage

- [ ] Add tests for FileViewerModal.tsx (currently 27% coverage)
- [ ] Add tests for AdminPage.tsx (currently 45% coverage)
- [ ] Add tests for admin tab components (MembershipsTab, PromptsTab, TenantsTab, UsersTab)
- [ ] Add tests for FilesPage.tsx (currently 38% coverage)
