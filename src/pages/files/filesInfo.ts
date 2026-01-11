import type { PageInfoContent } from '@/components/common/PageInfoModal';

export const filesInfo: PageInfoContent = {
  title: 'File Storage',
  overview: `File Storage provides a secure, tenant-isolated file management system with hierarchical folder organization.

Key Features:
• File Upload: Upload documents of any type with automatic MIME detection
• Folder Organization: Create nested folder structures for logical file grouping
• File Preview: View supported file types directly in the browser
• Download: Retrieve original files with preserved formatting
• Extraction Integration: Trigger document extraction for RAG processing
• Admin View: System administrators can view files across all tenants

Storage Architecture:
Files are stored in Netlify Blob Storage with unique blob keys. Metadata (name, path, size, type) is stored in PostgreSQL for fast querying. Each tenant's files are completely isolated through tenant_id scoping.

Supported Operations:
• Upload single or multiple files
• Create/delete folders (cascading delete for contents)
• Navigate folder hierarchy via breadcrumb
• View file details and extraction status
• Trigger extraction for RAG pipeline processing`,

  architecture: `┌─────────────────────────────────────────────────────────────┐
│                    File Storage UI                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Breadcrumb: Home > Documents > Reports              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  📁 Folder 1    📁 Folder 2                          │   │
│  │  📄 File1.pdf   📄 File2.docx   📄 File3.xlsx        │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │ files-list   │  │ files-upload │  │files-download│
     │ folders-*    │  │              │  │ files-delete │
     └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
            │                 │                 │
            ▼                 ▼                 ▼
     ┌─────────────────────────────────────────────────┐
     │              PostgreSQL (Neon)                  │
     │   files, folders tables                         │
     └─────────────────────────────────────────────────┘
                              │
                              ▼
     ┌─────────────────────────────────────────────────┐
     │           Netlify Blob Storage                  │
     │   Actual file binary content                    │
     └─────────────────────────────────────────────────┘`,

  tables: [
    {
      name: 'files',
      description: 'File metadata with references to blob storage',
      columns: ['file_id', 'tenant_id', 'file_name', 'file_path', 'blob_key', 'mime_type', 'size_bytes', 'created_at', 'created_by'],
      relationships: ['tenant_id → tenants.tenant_id', 'created_by → users.user_id', 'blob_key → blob_inventory.blob_key'],
    },
    {
      name: 'folders',
      description: 'Folder hierarchy for file organization',
      columns: ['folder_id', 'tenant_id', 'folder_name', 'folder_path', 'parent_path', 'created_at'],
      relationships: ['tenant_id → tenants.tenant_id'],
    },
    {
      name: 'blob_inventory',
      description: 'Tracks unique blobs and their extraction status',
      columns: ['blob_id', 'tenant_id', 'blob_key', 'file_name', 'mime_type', 'size_bytes', 'status', 'discovered_at'],
      relationships: ['tenant_id → tenants.tenant_id'],
    },
  ],

  apis: [
    {
      method: 'GET',
      path: '/api/files/list',
      description: 'List files and folders at a given path. Supports admin view across all tenants.',
      responseBody: `{
  "success": true,
  "path": "/Documents",
  "tenantId": "uuid",
  "totalFileCount": 15,
  "files": [{ "id": "uuid", "name": "report.pdf", "size": 102400, "mimeType": "application/pdf" }],
  "folders": [{ "id": "uuid", "name": "Reports", "path": "/Documents/Reports", "fileCount": 3 }]
}`,
    },
    {
      method: 'POST',
      path: '/api/files/upload',
      description: 'Upload a file to the specified path. File is stored in blob storage with metadata in PostgreSQL.',
      requestBody: `FormData: {
  file: File,
  path: "/Documents"
}`,
      responseBody: `{
  "success": true,
  "fileId": "uuid",
  "fileName": "report.pdf",
  "blobKey": "tenant/uuid/report.pdf"
}`,
    },
    {
      method: 'GET',
      path: '/api/files/download',
      description: 'Download a file by ID. Returns the binary file content.',
      responseBody: `Binary file content with appropriate Content-Type header`,
    },
    {
      method: 'DELETE',
      path: '/api/files/delete',
      description: 'Delete a file by ID. Removes both metadata and blob storage content.',
      responseBody: `{ "success": true, "deleted": true, "fileId": "uuid" }`,
    },
    {
      method: 'POST',
      path: '/api/folders/create',
      description: 'Create a new folder at the specified path.',
      requestBody: `{ "name": "New Folder", "parentPath": "/Documents" }`,
      responseBody: `{ "success": true, "folderId": "uuid", "folderPath": "/Documents/New Folder" }`,
    },
    {
      method: 'DELETE',
      path: '/api/folders/delete',
      description: 'Delete a folder and all its contents (cascading delete).',
      responseBody: `{ "success": true, "deleted": true, "filesDeleted": 5 }`,
    },
  ],
};
