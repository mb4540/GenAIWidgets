# ToDos

## UI Changes

- [ ] Change "Gemini" header above the dropdown to "Google" on the AI Gateway Chat page

## File Storage Page

- [ ] Add a label to the green check + number indicator (shows number of chunks extracted from document)
- [ ] Add ability to view the extracted chunks for a document
- [ ] Show document count per folder
- [ ] Show total document count
- [ ] Ensure counts are tenant-sensitive (users see only their tenant's files)
- [ ] Admin view: ability to see ALL blob storage files across all tenants
- [ ] Admin view: show which tenant each file belongs to

## Admin Prompts - Edit Prompt Modal

- [ ] Change Model Name from text field to dropdown (like AI Gateway Chat page)
- [ ] Create a common/reusable model selector component that can be shared between Edit Prompt modal and AI Gateway Chat page

## Test Coverage

- [ ] Add tests for FileViewerModal.tsx (currently 27% coverage)
- [ ] Add tests for AdminPage.tsx (currently 45% coverage)
- [ ] Add tests for admin tab components (MembershipsTab, PromptsTab, TenantsTab, UsersTab)
- [ ] Add tests for FilesPage.tsx (currently 38% coverage)
