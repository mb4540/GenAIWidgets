import type { PageInfoContent } from '@/components/common/PageInfoModal';

export const dashboardInfo: PageInfoContent = {
  title: 'Dashboard',
  overview: `The Dashboard provides a real-time overview of your organization's GenAI Widgets activity and resources.

Key Metrics Displayed:
• Total Files: Count of all files uploaded to your tenant's file storage
• Folders: Number of folder structures created for organization
• Extractions: Documents that have been processed through the extraction pipeline
• Chunks: Total text segments extracted from documents for RAG processing
• Q&A Pairs: Generated question-answer pairs for truth set validation

The Recent Activity feed shows the latest extraction and Q&A generation jobs, helping you monitor pipeline progress and identify any failures that need attention.

All statistics are tenant-scoped, meaning each organization only sees their own data.`,

  architecture: `┌─────────────────────────────────────────────────────────────┐
│                      Dashboard Page                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │  Files  │ │Extract  │ │ Chunks  │ │  Q&A    │            │
│  │  Card   │ │  Card   │ │  Card   │ │  Card   │            │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │
│       │           │           │           │                  │
│       └───────────┴───────────┴───────────┘                  │
│                       │                                      │
│              ┌────────▼────────┐                             │
│              │ Recent Activity │                             │
│              │      Feed       │                             │
│              └────────┬────────┘                             │
└───────────────────────┼─────────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  Netlify Func   │
              │ dashboard-stats │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐   ┌──────────┐   ┌──────────┐
   │  files  │   │blob_inv  │   │chunk_qa  │
   │ folders │   │ext_jobs  │   │qa_jobs   │
   └─────────┘   └──────────┘   └──────────┘`,

  tables: [
    {
      name: 'files',
      description: 'Stores uploaded file metadata with blob storage references',
      columns: ['file_id', 'tenant_id', 'file_name', 'file_path', 'blob_key', 'mime_type', 'size_bytes', 'created_at'],
      relationships: ['tenant_id → tenants.tenant_id', 'blob_key → blob_inventory.blob_key'],
    },
    {
      name: 'folders',
      description: 'Hierarchical folder structure for file organization',
      columns: ['folder_id', 'tenant_id', 'folder_name', 'folder_path', 'parent_path', 'created_at'],
      relationships: ['tenant_id → tenants.tenant_id'],
    },
    {
      name: 'blob_inventory',
      description: 'Tracks extraction status for each unique blob',
      columns: ['blob_id', 'tenant_id', 'blob_key', 'file_name', 'status', 'discovered_at'],
      relationships: ['tenant_id → tenants.tenant_id'],
    },
    {
      name: 'extraction_jobs',
      description: 'Records of document extraction processing jobs',
      columns: ['job_id', 'blob_id', 'status', 'chunk_count', 'queued_at', 'started_at', 'completed_at'],
      relationships: ['blob_id → blob_inventory.blob_id'],
    },
    {
      name: 'chunk_qa_pairs',
      description: 'Generated Q&A pairs for RAG truth set validation',
      columns: ['qa_id', 'job_id', 'tenant_id', 'chunk_index', 'question', 'answer', 'status', 'created_at'],
      relationships: ['job_id → qa_generation_jobs.job_id', 'tenant_id → tenants.tenant_id'],
    },
  ],

  apis: [
    {
      method: 'GET',
      path: '/api/dashboard/stats',
      description: 'Fetches aggregated statistics for the dashboard. Returns file counts, extraction status, chunk totals, Q&A pair stats, and recent activity.',
      responseBody: `{
  "success": true,
  "fileStats": { "totalFiles": 10, "totalFolders": 3 },
  "extractionStats": { "pending": 2, "processing": 0, "extracted": 8, "failed": 0, "totalChunks": 45 },
  "qaStats": { "totalPairs": 15, "pending": 5, "approved": 10, "rejected": 0 },
  "recentActivity": [
    { "type": "extraction", "fileName": "doc.pdf", "status": "completed", "timestamp": "2026-01-11T..." }
  ]
}`,
    },
  ],
};
