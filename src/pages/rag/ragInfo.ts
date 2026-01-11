import type { PageInfoContent } from '@/components/common/PageInfoModal';

export const ragInfo: PageInfoContent = {
  title: 'RAG Preprocessing',
  overview: `RAG Preprocessing manages the document extraction and Q&A truth set generation pipeline for Retrieval-Augmented Generation systems.

Key Features:
• Blob Inventory: View all unique documents discovered across file uploads
• Extraction Pipeline: Process documents through LLM-powered extraction to generate structured chunks
• Status Tracking: Monitor extraction progress (pending, processing, extracted, failed)
• Q&A Generation: Generate question-answer pairs from extracted chunks for truth set validation
• Q&A Review: Approve, edit, or reject generated Q&A pairs before use in evaluation

Extraction Process:
1. Files uploaded to File Storage are automatically added to blob_inventory
2. Extraction jobs process documents using Gemini LLM to extract structured content
3. Output is stored as JSONL with chunk text, metadata, and provenance information
4. Chunks can then be used for Q&A generation or vectorization

Q&A Truth Set:
The Q&A generator creates question-answer pairs from document chunks. These pairs serve as ground truth for evaluating RAG system retrieval quality. Human review ensures accuracy before pairs are used in automated testing.`,

  architecture: `┌─────────────────────────────────────────────────────────────┐
│                  RAG Preprocessing UI                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Status Tabs: All | Pending | Processing | Extracted │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  File Name    | Type | Size | Status | Actions       │   │
│  │  doc.pdf      | PDF  | 1MB  | ✓      | View Generate │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│extraction-inv   │   │extraction-worker│   │qa-generate-bg   │
│extraction-content│  │  (background)   │   │  (background)   │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Neon)                         │
│  blob_inventory | extraction_jobs | qa_generation_jobs      │
│                 | extraction_outputs | chunk_qa_pairs       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Netlify Blob Storage                       │
│  Extraction JSONL outputs stored per blob                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Google Gemini API                         │
│  Document extraction and Q&A generation LLM calls           │
└─────────────────────────────────────────────────────────────┘`,

  tables: [
    {
      name: 'blob_inventory',
      description: 'Tracks unique blobs and their extraction status',
      columns: ['blob_id', 'tenant_id', 'blob_key', 'file_name', 'mime_type', 'size_bytes', 'status', 'discovered_at'],
      relationships: ['tenant_id → tenants.tenant_id'],
    },
    {
      name: 'extraction_jobs',
      description: 'Records of document extraction processing jobs',
      columns: ['job_id', 'blob_id', 'prompt_id', 'status', 'chunk_count', 'queued_at', 'started_at', 'completed_at', 'error_message'],
      relationships: ['blob_id → blob_inventory.blob_id', 'prompt_id → prompts.prompt_id'],
    },
    {
      name: 'extraction_outputs',
      description: 'References to extraction output files in blob storage',
      columns: ['output_id', 'job_id', 'output_blob_key', 'format', 'created_at'],
      relationships: ['job_id → extraction_jobs.job_id'],
    },
    {
      name: 'qa_generation_jobs',
      description: 'Q&A generation job tracking',
      columns: ['job_id', 'blob_id', 'tenant_id', 'status', 'questions_per_chunk', 'total_chunks', 'processed_chunks', 'total_qa_generated', 'created_at', 'completed_at'],
      relationships: ['blob_id → blob_inventory.blob_id', 'tenant_id → tenants.tenant_id'],
    },
    {
      name: 'chunk_qa_pairs',
      description: 'Generated Q&A pairs for truth set validation',
      columns: ['qa_id', 'job_id', 'tenant_id', 'chunk_index', 'question', 'answer', 'status', 'created_at', 'updated_at'],
      relationships: ['job_id → qa_generation_jobs.job_id', 'tenant_id → tenants.tenant_id'],
    },
    {
      name: 'prompts',
      description: 'Configurable prompts for extraction and Q&A generation',
      columns: ['prompt_id', 'prompt_name', 'system_prompt', 'user_prompt_template', 'model_name', 'temperature', 'max_tokens'],
      relationships: [],
    },
  ],

  apis: [
    {
      method: 'GET',
      path: '/api/extraction/inventory',
      description: 'List blob inventory with extraction status. Supports filtering by status.',
      responseBody: `{
  "success": true,
  "inventory": [
    { "id": "uuid", "fileName": "doc.pdf", "status": "extracted", "chunkCount": 12, "discoveredAt": "..." }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/api/extraction/trigger',
      description: 'Trigger extraction for a blob. Queues a background job.',
      requestBody: `{ "blobId": "uuid" }`,
      responseBody: `{ "success": true, "jobId": "uuid", "status": "queued" }`,
    },
    {
      method: 'GET',
      path: '/api/extraction/content',
      description: 'Retrieve extracted content (chunks) for a blob.',
      responseBody: `{
  "success": true,
  "chunks": [
    { "chunkText": "...", "provenance": { "pageNumber": 1, "sectionPath": ["Introduction"] } }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/api/qa-generate-background',
      description: 'Generate Q&A pairs for a blob. Background function with 15-min timeout.',
      requestBody: `{ "blobId": "uuid", "questionsPerChunk": 3 }`,
      responseBody: `{ "success": true, "jobId": "uuid" }`,
    },
    {
      method: 'GET',
      path: '/api/qa/list',
      description: 'List Q&A pairs for a blob with optional status filter.',
      responseBody: `{
  "success": true,
  "qaPairs": [
    { "qaId": "uuid", "question": "What is...?", "answer": "...", "status": "pending" }
  ],
  "stats": { "total": 10, "pending": 5, "approved": 5, "rejected": 0 }
}`,
    },
    {
      method: 'PUT',
      path: '/api/qa/update',
      description: 'Update a Q&A pair (edit question/answer or change status).',
      requestBody: `{ "qaId": "uuid", "question": "Updated?", "answer": "Updated.", "status": "approved" }`,
      responseBody: `{ "success": true }`,
    },
    {
      method: 'POST',
      path: '/api/qa/bulk-approve',
      description: 'Approve all pending Q&A pairs for a blob.',
      requestBody: `{ "blobId": "uuid", "approveAll": true }`,
      responseBody: `{ "success": true, "approvedCount": 5 }`,
    },
  ],
};
