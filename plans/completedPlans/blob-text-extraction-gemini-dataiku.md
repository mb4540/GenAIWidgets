# Blob File Text Extraction (Gemini 2.5 Pro) + Dataiku JSON Plan

## Overview
Extract normalized, high-quality text from files stored in blob storage using Gemini 2.5 Pro, then persist the results in a standardized JSON format optimized for Dataiku ingestion and high retrieval match rates.

## Goals
- Produce **consistent, searchable text** across PDFs, Office docs, images, and plain text.
- Preserve **document structure** (title/sections/pages) to improve chunk relevance.
- Output **Dataiku-friendly JSON** that supports:
  - Row-per-chunk retrieval datasets
  - Provenance tracking (where each chunk came from)
  - Reprocessing/versioning/deduplication
- **Track full lineage** from source blob → extraction process → output blob in Neon PostgreSQL
- Maintain **blob inventory** with extraction status, versioning, and audit trail

## Non-Goals
- Building the full retrieval/embedding pipeline inside this plan (we’ll enable it via schema and recommended Dataiku recipes).
- Client-side extraction (all sensitive processing should be server-side).

## Key Design Decisions (for highest retrieval match rates)
- **Chunk first-class output**: primary dataset is **one JSON object per chunk** (JSONL), because retrieval systems typically rank chunks, not entire documents.
- **Canonical search fields**: maintain a dedicated `searchText` field per chunk with normalized whitespace and header context.
- **Strong provenance**: include `sourceUri`, `pageStart/pageEnd`, and `byteHash`/`contentHash` for traceability and dedupe.
- **Deterministic chunking**: stable chunk boundaries where possible (page/section-aware) to reduce index churn.

## Inputs
- Blob object (bytes) and metadata:
  - `sourceUri` (blob URL / bucket+key)
  - `mimeType`
  - `fileName`
  - `sizeBytes`
  - optional `etag` / version ID

## Outputs
### Output A (recommended): Chunk Dataset (JSON Lines)
A `.jsonl` file where each line is a single chunk record.

### Output B (optional): Document Summary Record (JSON)
A single doc-level record containing document metadata and extraction stats.

## Implementation Plan

### Phase 1: Storage Access + Security
- [x] Define blob storage provider(s) and access pattern
  - Using Netlify Blobs with server-side SDK (`@netlify/blobs`)
  - Source store: `user-files`, Output store: `extracted-chunks`
- [x] Enforce server-side processing
  - All extraction runs in `extraction-worker-background.ts` Netlify Function
- [x] Define allowed MIME types and max size limits
  - PDF, DOCX, DOC supported via file type detection
  - Word docs converted to PDF before Gemini processing
- [x] Define environment variables (no secrets in client)
  - `DATABASE_URL` - Neon PostgreSQL connection
  - `GEMINI_API_KEY` - Gemini API key (via Netlify AI Gateway)
  - `GOOGLE_GEMINI_BASE_URL` - Optional custom base URL

### Phase 2: File Pre-Processing
- [x] Identify file type and extraction strategy
  - Implemented in `extraction-worker-background.ts`: `isWordDocument()`, `isPdfDocument()`
  - PDF sent directly to Gemini
  - DOCX/DOC converted to PDF via `mammoth` + `pdf-lib`
- [x] If necessary, convert to a Gemini-friendly representation
  - Word→PDF conversion implemented in `convertWordToPdf()`
  - Uses `mammoth` for text extraction, `pdf-lib` for PDF generation
  - PDFs sent as base64 inline_data to Gemini
- [x] Compute `byteHash` (SHA-256) for dedupe
  - `byte_hash_sha256` column in `blob_inventory` table
  - Content hash computed for output JSONL

### Phase 3: Gemini 2.5 Pro Extraction
- [x] Create a single “extraction” request template that returns structured output
  - Prompt stored in `prompts` table with `function_name='extraction'`
  - Fetched via `getPromptConfig()` in worker
  - Model: `gemini-2.5-pro-preview-05-06`
- [x] Use a response contract that is easy to validate
  - `responseMimeType: 'application/json'` enforces JSON output
  - Fallback parsing for non-JSON responses
- [x] Include explicit instructions to:
  - preserve headings (via `headings[]` in page objects)
  - preserve page numbers (via `pageNumber` field)
  - keep original language (via `language` field)
  - Return structured JSON with title, language, pages array

### Phase 4: Post-Processing + Normalization
- [ ] Normalize whitespace and hyphenation artifacts
- [ ] Remove repeated headers/footers where detected
- [x] Language detection (store `language`)
  - Gemini returns `language` field in extraction response
  - Stored in chunk records
- [ ] Optional PII redaction hook (pluggable)
- [x] Generate extraction metrics
  - `chunk_count` tracked in `extraction_jobs` table
  - `processing_time_ms` recorded per job
  - `size_bytes` stored in `extraction_outputs`

### Phase 5: Chunking Strategy (Retrieval-Optimized)
- [x] Chunk using a hybrid strategy:
  - Page-aware chunking implemented in `createChunkRecords()`
  - Falls back to character window chunking via `chunkText()`
- [x] Recommended targets:
  - chunk size: 1000 chars with 100 char overlap (implemented)
  - Configurable in `chunkText(chunkSize=1000, overlap=100)`
- [x] Create `searchText` per chunk:
  - Implemented: `title + sectionPath + chunkText` concatenation
  - Stored in `content.searchText` field

### Phase 6: Standardized JSON Schema (Dataiku-Friendly)
- [ ] Implement schema validation (fail closed)
- [x] Write JSONL for chunk dataset
  - Implemented in `extraction-worker-background.ts`
  - Output stored in `extracted-chunks` blob store
  - Each line is a `ChunkRecord` with full schema
- [ ] Write doc-level JSON record (optional)

### Phase 7: Dataiku Ingestion + Retrieval Evaluation
- [ ] Ingest JSONL as a Dataiku dataset (row-per-chunk)
- [ ] Build/validate:
  - a text-prep recipe to ensure consistent casing/whitespace rules
  - optional embedding recipe / vector index (depending on your Dataiku setup)
- [ ] Evaluate retrieval match rates
  - test queries, top-k relevance checks
  - analyze failure modes (chunk size too small/large, missing headers, noisy artifacts)

### Phase 8: Neon PostgreSQL Lineage Tracking ✅ COMPLETED

Track the complete lifecycle of blobs through the extraction pipeline with full accounting.

**Status**: Fully implemented in `migrations/004_extraction_lineage_tables.sql`

#### Database Schema

```sql
-- Blob Inventory: tracks all source blobs
CREATE TABLE blob_inventory (
  blob_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  
  -- Blob identification
  source_store VARCHAR(100) NOT NULL,        -- e.g., 'user-files', 'raw-uploads'
  blob_key VARCHAR(500) NOT NULL,            -- unique key within store
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  byte_hash_sha256 VARCHAR(64),              -- for deduplication
  etag VARCHAR(100),
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, processing, extracted, failed, archived
  extraction_priority INTEGER DEFAULT 0,
  
  -- Timestamps
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(source_store, blob_key)
);

-- Extraction Jobs: tracks each extraction attempt
CREATE TABLE extraction_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blob_id UUID NOT NULL REFERENCES blob_inventory(blob_id),
  
  -- Job configuration
  extraction_version VARCHAR(50) NOT NULL,   -- e.g., '2026-01-10'
  model_version VARCHAR(100),                -- e.g., 'gemini-2.5-pro-preview'
  prompt_hash VARCHAR(64),                   -- hash of extraction prompt for reproducibility
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'queued',  -- queued, running, completed, failed, cancelled
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metrics
  processing_time_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  chunk_count INTEGER,
  
  -- Timestamps
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Correlation
  correlation_id VARCHAR(100)                -- for distributed tracing
);

-- Output Blobs: tracks extracted JSON chunks stored in output blob store
CREATE TABLE extraction_outputs (
  output_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES extraction_jobs(job_id),
  blob_id UUID NOT NULL REFERENCES blob_inventory(blob_id),
  
  -- Output blob location
  output_store VARCHAR(100) NOT NULL,        -- e.g., 'extracted-chunks'
  output_blob_key VARCHAR(500) NOT NULL,     -- key in output store
  
  -- Output metadata
  output_type VARCHAR(50) NOT NULL,          -- 'chunk_jsonl', 'document_json'
  chunk_count INTEGER,
  size_bytes BIGINT,
  content_hash_sha256 VARCHAR(64),
  
  -- Schema versioning
  schema_version VARCHAR(20) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(output_store, output_blob_key)
);

-- Chunk Index: optional detailed tracking of individual chunks
CREATE TABLE chunk_index (
  chunk_id VARCHAR(100) PRIMARY KEY,         -- documentId:chunkNum
  output_id UUID NOT NULL REFERENCES extraction_outputs(output_id),
  blob_id UUID NOT NULL REFERENCES blob_inventory(blob_id),
  
  -- Chunk metadata (denormalized for query performance)
  document_id UUID NOT NULL,
  chunk_sequence INTEGER NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  section_path TEXT[],
  
  -- Content summary (for search/filtering without loading full chunk)
  char_count INTEGER,
  language VARCHAR(10),
  
  -- Quality
  confidence DECIMAL(3,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_blob_inventory_status ON blob_inventory(status);
CREATE INDEX idx_blob_inventory_tenant ON blob_inventory(tenant_id);
CREATE INDEX idx_blob_inventory_hash ON blob_inventory(byte_hash_sha256);
CREATE INDEX idx_extraction_jobs_blob ON extraction_jobs(blob_id);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX idx_extraction_outputs_blob ON extraction_outputs(blob_id);
CREATE INDEX idx_chunk_index_document ON chunk_index(document_id);
```

#### Lineage Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  Source Blob    │────▶│  Extraction Job  │────▶│   Output Blob     │
│  (user-files)   │     │  (Gemini 2.5)    │     │ (extracted-chunks)│
└─────────────────┘     └──────────────────┘     └───────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│ blob_inventory  │     │ extraction_jobs  │     │extraction_outputs │
│                 │     │                  │     │                   │
│ - blob_id       │◀────│ - blob_id (FK)   │────▶│ - job_id (FK)     │
│ - status        │     │ - status         │     │ - blob_id (FK)    │
│ - byte_hash     │     │ - metrics        │     │ - output_blob_key │
└─────────────────┘     └──────────────────┘     └───────────────────┘
                                                          │
                                                          ▼
                                                 ┌───────────────────┐
                                                 │   chunk_index     │
                                                 │                   │
                                                 │ - chunk_id        │
                                                 │ - output_id (FK)  │
                                                 │ - page_start/end  │
                                                 └───────────────────┘
```

#### Key Queries

```sql
-- Find all unprocessed blobs
SELECT * FROM blob_inventory 
WHERE status = 'pending' 
ORDER BY extraction_priority DESC, discovered_at ASC;

-- Get full lineage for a source file
SELECT 
  bi.file_name,
  bi.status AS blob_status,
  ej.status AS job_status,
  ej.extraction_version,
  ej.chunk_count,
  eo.output_blob_key,
  eo.created_at AS extracted_at
FROM blob_inventory bi
LEFT JOIN extraction_jobs ej ON bi.blob_id = ej.blob_id
LEFT JOIN extraction_outputs eo ON ej.job_id = eo.job_id
WHERE bi.blob_id = $1;

-- Find duplicate files by hash
SELECT byte_hash_sha256, COUNT(*) as count, array_agg(file_name)
FROM blob_inventory
GROUP BY byte_hash_sha256
HAVING COUNT(*) > 1;

-- Extraction job metrics
SELECT 
  DATE(completed_at) as date,
  COUNT(*) as jobs_completed,
  SUM(chunk_count) as total_chunks,
  AVG(processing_time_ms) as avg_processing_ms,
  SUM(input_tokens + output_tokens) as total_tokens
FROM extraction_jobs
WHERE status = 'completed'
GROUP BY DATE(completed_at);
```

### Phase 9: Operations
- [x] Idempotency via `contentHash` and `extractionVersion`
  - `content_hash_sha256` stored in `extraction_outputs`
  - `extraction_version` tracked per job
- [x] Retry policy and partial failure handling
  - `retry_count` column in `extraction_jobs`
  - Failed jobs update both `extraction_jobs` and `blob_inventory` status
- [x] Logging + correlation IDs (no sensitive content in logs)
  - `correlation_id` in `extraction_jobs` for distributed tracing
  - Console logging throughout worker with job context
- [ ] Reprocessing workflow when prompts/models change
- [ ] Blob inventory sync job (discover new files, mark deleted)
- [ ] Stale extraction detection (re-extract when model/prompt changes)

## Standardized JSON Schema

### A) Chunk Record (JSONL line)
Required fields are chosen to be easy to map into Dataiku columns and effective for retrieval.

```json
{
  "schemaVersion": "1.0",
  "extractionVersion": "2026-01-10",

  "documentId": "uuid-or-stable-id",
  "chunkId": "documentId:000123",

  "source": {
    "sourceUri": "blob://bucket/path/to/file.pdf",
    "fileName": "file.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 123456,
    "etag": "optional",
    "byteHashSha256": "..."
  },

  "provenance": {
    "pageStart": 3,
    "pageEnd": 4,
    "sectionPath": ["Contract", "Payment Terms"],
    "contentOffsetStart": 10234,
    "contentOffsetEnd": 15432
  },

  "content": {
    "title": "Document title if known",
    "chunkText": "The extracted text for this chunk...",
    "searchText": "Document title\nContract > Payment Terms\nThe extracted text for this chunk...",
    "language": "en"
  },

  "quality": {
    "confidence": 0.0,
    "warnings": []
  },

  "timestamps": {
    "extractedAt": "2026-01-10T19:21:00Z"
  }
}
```

### B) Document Record (optional)
```json
{
  "schemaVersion": "1.0",
  "extractionVersion": "2026-01-10",

  "documentId": "uuid-or-stable-id",

  "source": {
    "sourceUri": "blob://bucket/path/to/file.pdf",
    "fileName": "file.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 123456,
    "etag": "optional",
    "byteHashSha256": "..."
  },

  "content": {
    "title": "Document title if known",
    "language": "en",
    "fullText": "Optional: entire extracted text (may be too large)"
  },

  "stats": {
    "pageCount": 10,
    "chunkCount": 42,
    "charCount": 250000
  },

  "timestamps": {
    "extractedAt": "2026-01-10T19:21:00Z"
  }
}
```

## Gemini Extraction Contract (Recommended)
Return a strict JSON object with:
- document-level: `title`, `language`, `pages[]` (if applicable)
- page entries include `pageNumber`, `text`, optional `headings[]`, optional `tables[]`

This enables deterministic downstream chunking rather than asking the model to decide chunk boundaries.

## Blob Store Configuration

| Store Name | Purpose | Provider |
|------------|---------|----------|
| `user-files` | Source blobs uploaded by users | Netlify Blobs |
| `extracted-chunks` | Output JSONL chunks for Dataiku | Netlify Blobs (or S3) |

## Extraction Workflow

```
1. DISCOVERY
   ├── New file uploaded to user-files blob store
   ├── Trigger: Netlify Function on upload OR scheduled sync job
   └── Action: INSERT into blob_inventory (status='pending')

2. QUEUE
   ├── Background job polls blob_inventory WHERE status='pending'
   ├── Checks for duplicates via byte_hash_sha256
   └── Creates extraction_jobs record (status='queued')

3. EXTRACTION
   ├── Worker picks up job, updates status='running'
   ├── Downloads blob from source store
   ├── Sends to Gemini 2.5 Pro for extraction
   ├── Records input_tokens, output_tokens, processing_time_ms
   └── On error: increment retry_count, set status='failed' if max retries

4. OUTPUT
   ├── Write JSONL to extracted-chunks blob store
   ├── INSERT into extraction_outputs with output_blob_key
   ├── Optionally INSERT chunk metadata into chunk_index
   └── Update blob_inventory status='extracted'

5. SYNC TO DATAIKU
   ├── Dataiku polls extraction_outputs for new records
   ├── Downloads JSONL from extracted-chunks store
   └── Ingests into Dataiku dataset
```

## API Endpoints (Netlify Functions) ✅ IMPLEMENTED

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/extraction/inventory` | GET | List blob inventory with status filters | ✅ `extraction-inventory.ts` |
| `/api/extraction/inventory?id=` | GET | Get full lineage for a blob | ✅ `extraction-inventory.ts` |
| `/api/extraction/jobs` | GET | List extraction jobs with status/date filters | ✅ `extraction-jobs.ts` |
| `/api/extraction/jobs?id=` | GET | Get job details and metrics | ✅ `extraction-jobs.ts` |
| `/api/extraction/jobs?stats=true` | GET | Aggregated extraction metrics | ✅ `extraction-jobs.ts` |
| `/api/extraction/trigger` | POST | Manually trigger extraction for a blob | ✅ `extraction-trigger.ts` |
| `/api/extraction/content?blobId=` | GET | Get extracted content for a blob | ✅ `extraction-content.ts` |

## Open Questions (Resolved)
- Which blob provider(s)? → **Netlify Blobs** (implemented)
- Target file types and max file sizes? → **PDF, DOCX, DOC** (implemented)
- Do you want to store `fullText` at doc level, or only chunk records? → **Chunk records only** (implemented)
- Do you have a preferred Dataiku retrieval stack? → **TBD** (not yet implemented)
- Do you need PII redaction? → **Not yet implemented**
- Should extraction run synchronously or via background queue? → **Background queue** via `extraction-trigger.ts` + `extraction-worker-background.ts`
- What is the retry policy? → **retry_count tracked**, manual re-trigger supported
