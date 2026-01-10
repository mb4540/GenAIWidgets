# Blob Storage Feature Plan

## Overview

Add a file management widget to the application using Netlify Blobs for storage and Neon PostgreSQL for metadata/directory structure tracking. Full CRUD capabilities with virtual directory organization.

---

## Architecture

### Storage Layer
- **Netlify Blobs**: Actual file binary storage via `@netlify/blobs` package
- **Neon PostgreSQL**: File metadata, directory structure, user ownership

### Key Design Decisions
1. **Virtual Directories**: Directory structure stored in database, not in blob keys
2. **Blob Keys**: Use UUIDs as blob keys (flat storage), database tracks hierarchy
3. **Tenant Isolation**: Files scoped to tenant via database, single blob store
4. **Admin Cross-Tenant Access**: Admin users can view/manage files across all tenants
5. **Metadata**: Store file info (name, type, size, path) in database

---

## Admin Role (System-Wide)

### Overview
Introduce a system-wide `admin` role that grants cross-tenant access for administrative purposes. This role is **not** specific to blob storage—it applies to all current and future features.

### Database Changes

#### New Table: `admins`

```sql
CREATE TABLE admins (
  admin_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  granted_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admins_user_id ON admins(user_id);
```

#### Alternative: Add `is_admin` Column to Users

```sql
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
```

**Recommendation**: Use the `admins` table approach for better audit trail (who granted, when).

### Admin Capabilities

| Feature | Regular User | Admin |
|---------|--------------|-------|
| View own tenant files | ✅ | ✅ |
| View all tenant files | ❌ | ✅ |
| Manage own tenant files | ✅ | ✅ |
| Manage all tenant files | ❌ | ✅ |
| View all tenants list | ❌ | ✅ |
| View all users list | ❌ | ✅ |
| Access admin dashboard | ❌ | ✅ |

### Authorization Pattern

All API endpoints should follow this pattern:

```typescript
// Helper function for all endpoints
async function authorizeRequest(
  userId: string,
  tenantId: string,
  requiredTenantId?: string
): Promise<{ isAdmin: boolean; canAccess: boolean }> {
  const isAdmin = await checkIsAdmin(userId);
  
  if (isAdmin) {
    return { isAdmin: true, canAccess: true };
  }
  
  // Regular user - must match tenant
  if (requiredTenantId && tenantId !== requiredTenantId) {
    return { isAdmin: false, canAccess: false };
  }
  
  return { isAdmin: false, canAccess: true };
}
```

### Admin UI Considerations

1. **Tenant Selector**: Admins see a tenant dropdown to switch context
2. **Visual Indicator**: Clear badge/indicator when viewing as admin
3. **Audit Trail**: Log admin actions for accountability
4. **Admin Dashboard**: Future dedicated admin section

---

## Database Schema

### New Table: `files`

```sql
CREATE TABLE files (
  file_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  blob_key      TEXT NOT NULL,           -- UUID key in Netlify Blobs
  file_name     TEXT NOT NULL,           -- Original filename
  file_path     TEXT NOT NULL DEFAULT '/', -- Virtual directory path (e.g., '/documents/reports/')
  mime_type     TEXT,                    -- MIME type
  file_size     BIGINT,                  -- Size in bytes
  etag          TEXT,                    -- Blob ETag for versioning
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_files_tenant_id ON files(tenant_id);
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_path ON files(tenant_id, file_path);
CREATE UNIQUE INDEX idx_files_blob_key ON files(blob_key);

-- Trigger for updated_at
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### New Table: `folders` (Virtual Directories)

```sql
CREATE TABLE folders (
  folder_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  folder_name   TEXT NOT NULL,           -- Folder display name
  folder_path   TEXT NOT NULL,           -- Full path (e.g., '/documents/reports/')
  parent_path   TEXT NOT NULL DEFAULT '/', -- Parent folder path
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_folders_tenant_id ON folders(tenant_id);
CREATE INDEX idx_folders_path ON folders(tenant_id, folder_path);
CREATE UNIQUE INDEX idx_folders_unique_path ON folders(tenant_id, folder_path);
```

---

## API Endpoints (Netlify Functions)

### Files API: `/api/files/*`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files` | List files in a directory (query: `path`) |
| GET | `/api/files/:id` | Get file metadata |
| GET | `/api/files/:id/download` | Download file content |
| POST | `/api/files/upload` | Upload new file (multipart/form-data) |
| PUT | `/api/files/:id` | Update file metadata (rename, move) |
| DELETE | `/api/files/:id` | Delete file |

### Folders API: `/api/folders/*`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/folders` | List folders in a directory (query: `path`) |
| POST | `/api/folders` | Create new folder |
| PUT | `/api/folders/:id` | Rename/move folder |
| DELETE | `/api/folders/:id` | Delete folder (and contents) |

---

## Netlify Functions Implementation

### `netlify/functions/files-list.ts`
- Authenticate user via JWT
- Query database for files at given path for user's tenant
- Return file metadata array

### `netlify/functions/files-upload.ts`
- Authenticate user via JWT
- Parse multipart form data
- Generate UUID for blob key
- Store file in Netlify Blobs: `getStore('user-files').set(blobKey, file)`
- Insert metadata into `files` table
- Return file metadata

### `netlify/functions/files-download.ts`
- Authenticate user via JWT
- Verify file belongs to user's tenant
- Retrieve blob: `getStore('user-files').get(blobKey, { type: 'stream' })`
- Return file with appropriate Content-Type header

### `netlify/functions/files-delete.ts`
- Authenticate user via JWT
- Verify file belongs to user's tenant
- Delete from Netlify Blobs: `getStore('user-files').delete(blobKey)`
- Delete from database

### `netlify/functions/folders-*.ts`
- CRUD operations on `folders` table
- Cascade operations for folder deletion (delete child files/folders)

---

## Frontend Components

### New Page: `src/pages/files/FilesPage.tsx`
- Main file browser interface
- Breadcrumb navigation for directory path
- Grid/list view toggle
- File/folder icons based on type

### Components

```
src/components/files/
├── FileBrowser.tsx        # Main container with path state
├── FileList.tsx           # Grid/list of files and folders
├── FileItem.tsx           # Individual file/folder card
├── FolderItem.tsx         # Folder card with click to navigate
├── FileUploadButton.tsx   # Upload button with drag-drop zone
├── FileUploadModal.tsx    # Upload progress modal
├── CreateFolderModal.tsx  # New folder dialog
├── FileContextMenu.tsx    # Right-click menu (rename, delete, move)
├── BreadcrumbNav.tsx      # Path navigation
└── FilePreview.tsx        # Preview modal for images/text
```

### State Management
- Current path state in FileBrowser
- File list fetched on path change
- Optimistic updates for better UX

---

## Navigation Update

### `src/components/layout/AppLayout.tsx`
Add new nav item:
```tsx
{ name: 'File Storage', href: '/files', icon: FolderIcon }
```

### `src/App.tsx`
Add route:
```tsx
<Route path="/files" element={<FilesPage />} />
```

---

## Implementation Phases

### Phase 1: Database & Backend
- [ ] Create migration for `admins` table
- [ ] Create migration for `files` and `folders` tables
- [ ] Create `checkIsAdmin()` helper function
- [ ] Update auth middleware to include admin status in JWT/context
- [ ] Install `@netlify/blobs` package
- [ ] Implement `files-upload.ts` function (with admin support)
- [ ] Implement `files-list.ts` function (with admin cross-tenant)
- [ ] Implement `files-download.ts` function (with admin support)
- [ ] Implement `files-delete.ts` function (with admin support)
- [ ] Implement `folders-*` functions (with admin support)
- [ ] Update `netlify.toml` with new redirects

### Phase 2: Frontend Core
- [ ] Create FilesPage component
- [ ] Create FileBrowser component
- [ ] Create FileList component
- [ ] Create FileItem and FolderItem components
- [ ] Create BreadcrumbNav component
- [ ] Add navigation link in AppLayout
- [ ] Add route in App.tsx
- [ ] Add TenantSelector component for admins
- [ ] Add admin indicator badge in header

### Phase 3: Upload & Actions
- [ ] Create FileUploadButton with drag-drop
- [ ] Create FileUploadModal with progress
- [ ] Create CreateFolderModal
- [ ] Implement file download
- [ ] Implement file/folder delete

### Phase 4: Enhanced Features
- [ ] Create FileContextMenu (right-click)
- [ ] Implement rename functionality
- [ ] Implement move functionality
- [ ] Create FilePreview for images/text
- [ ] Add search functionality

### Phase 5: Testing
- [ ] Unit tests for file functions
- [ ] Component tests for FileBrowser
- [ ] Integration tests for upload/download flow

---

## Security Considerations

1. **Authentication**: All endpoints require valid JWT
2. **Tenant Isolation**: Files scoped to tenant via database queries
3. **Admin Authorization**: 
   - Admin status checked on every cross-tenant request
   - Admin actions logged for audit
   - Admin cannot be self-granted (requires existing admin)
4. **File Validation**: 
   - Max file size limit (e.g., 10MB)
   - Allowed MIME types whitelist
   - Filename sanitization
5. **Path Traversal Prevention**: Validate and sanitize file paths

---

## Dependencies

```bash
npm install @netlify/blobs uuid
npm install -D @types/uuid
```

---

## File Size Limits

Per Netlify Blobs documentation:
- Individual blob max size: 500MB (Starter), 5GB (Pro+)
- Recommend limiting to 10MB for user uploads initially

---

## Notes

- Netlify Blobs store name: `user-files`
- Virtual directories allow flexible organization without blob key restructuring
- ETag stored for potential future versioning/conflict detection
- Consider adding file sharing feature in future iteration
