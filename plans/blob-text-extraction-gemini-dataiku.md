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
- [ ] Define blob storage provider(s) and access pattern
  - Signed URL generation OR server-side SDK download
- [ ] Enforce server-side processing
- [ ] Define allowed MIME types and max size limits
- [ ] Define environment variables (no secrets in client)
  - Blob credentials (provider-specific)
  - Gemini/Vertex credentials

### Phase 2: File Pre-Processing
- [ ] Identify file type and extraction strategy
  - PDF / DOCX / XLSX / PPTX / images / text
- [ ] If necessary, convert to a Gemini-friendly representation
  - Prefer sending the **original file bytes** when supported
  - If not supported or too large, fall back to:
    - page images for OCR-style extraction
    - text extraction via lightweight parser, then Gemini for cleanup/structure
- [ ] Compute `byteHash` (SHA-256) for dedupe

### Phase 3: Gemini 2.5 Pro Extraction
- [ ] Create a single “extraction” request template that returns structured output
- [ ] Use a response contract that is easy to validate
  - Avoid freeform prose responses
- [ ] Include explicit instructions to:
  - preserve headings
  - preserve page numbers where known
  - output tables as markdown (or a structured array if you prefer)
  - keep original language
  - avoid hallucinating missing content

### Phase 4: Post-Processing + Normalization
- [ ] Normalize whitespace and hyphenation artifacts
- [ ] Remove repeated headers/footers where detected
- [ ] Language detection (store `language`)
- [ ] Optional PII redaction hook (pluggable)
- [ ] Generate extraction metrics
  - char counts, token estimates, page counts, chunk counts

### Phase 5: Chunking Strategy (Retrieval-Optimized)
- [ ] Chunk using a hybrid strategy:
  - Prefer section-boundary chunking when headings exist
  - Fallback to token/character window chunking with overlap
- [ ] Recommended targets:
  - chunk size: ~800–1200 tokens
  - overlap: ~80–150 tokens
- [ ] Create `searchText` per chunk:
  - `title + sectionPath + chunkText` (normalized)

### Phase 6: Standardized JSON Schema (Dataiku-Friendly)
- [ ] Implement schema validation (fail closed)
- [ ] Write JSONL for chunk dataset
- [ ] Write doc-level JSON record (optional)

### Phase 7: Dataiku Ingestion + Retrieval Evaluation
- [ ] Ingest JSONL as a Dataiku dataset (row-per-chunk)
- [ ] Build/validate:
  - a text-prep recipe to ensure consistent casing/whitespace rules
  - optional embedding recipe / vector index (depending on your Dataiku setup)
- [ ] Evaluate retrieval match rates
  - test queries, top-k relevance checks
  - analyze failure modes (chunk size too small/large, missing headers, noisy artifacts)

### Phase 8: Operations
- [ ] Idempotency via `contentHash` and `extractionVersion`
- [ ] Retry policy and partial failure handling
- [ ] Logging + correlation IDs (no sensitive content in logs)
- [ ] Reprocessing workflow when prompts/models change

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

## Open Questions (Answering these will tighten implementation)
- Which blob provider(s)? (Azure Blob / S3 / GCS)
- Target file types and max file sizes?
- Do you want to store `fullText` at doc level, or only chunk records?
- Do you have a preferred Dataiku retrieval stack (Vector DB / Dataiku Vector Store / external index)?
- Do you need PII redaction, and if so what policy?
