# Plan: Fix RAG Preprocessing Pipeline (AI Gateway Required)

## Overview

The RAG Preprocessing pipeline in GenAIWidgets is not working as desired. This plan refactors the existing extraction infrastructure to reliably extract structured content from uploaded documents.

**Reference Implementation:** The AI-EssayGrader project (now in this workspace) has a well-functioning document extraction backend. Its patterns (trigger/background/status flow, job management, UI polling) serve as a **reference only** for how to implement reliable document extraction in GenAIWidgets.

**Important:** This plan focuses on the GenAIWidgets **RAG Preprocessing** feature. The AI-EssayGrader code is for reference purposes only—we are not porting "rubric extraction" as a feature name into GenAIWidgets.

## Goals

- Fix the **RAG Preprocessing** pipeline in GenAIWidgets to reliably extract structured content from documents.
- Apply proven patterns from AI-EssayGrader's extraction backend:
  - Trigger → Background Worker → Status polling flow
  - Job persistence and status tracking
  - Word-to-PDF conversion for consistent LLM processing
  - Strict JSON output with validation
- Ensure **AI Gateway is the only LLM access path** (Netlify-injected env vars in serverless functions).
- Improve the extraction prompt for higher-quality, structured output.

## Non-Goals

- Adding a separate "rubric extraction" feature to GenAIWidgets (that's an AI-EssayGrader concept).
- Building embeddings/vector indexing (separate effort).

## Constraints / Requirements

- **MUST use AI Gateway for LLM interaction.**
  - LLM calls occur in Netlify Functions only.
  - Credentials/base URLs come from Netlify-injected env vars (`GEMINI_API_KEY`, `GOOGLE_GEMINI_BASE_URL`, etc.).
- Support document types:
  - `application/pdf`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.docx`)
  - `application/msword` (`.doc`)
- Extraction must produce strict, validated JSON output.
- UI must show extraction progress and allow review of results.

---

## Reference: AI-EssayGrader Extraction Patterns (For Study Only)

The following components in AI-EssayGrader demonstrate a working extraction flow. **Study these patterns, do not copy the "rubric" naming into GenAIWidgets.**

### Backend Flow (Netlify Functions)
| Component | Purpose |
|-----------|---------|
| `extract-rubric-trigger.ts` | Creates job record, fire-and-forget calls background worker |
| `extract-rubric-background.ts` | Downloads file, converts Word→PDF, calls Gemini, parses JSON, updates job |
| `extract-rubric-status.ts` | Returns job status and result to frontend |
| `lib/rubric-job-storage.ts` | Job persistence using Netlify Blobs |

### Key Techniques
- **Word→PDF Conversion:** Uses `mammoth` to extract text from `.docx`, then `pdf-lib` to create a PDF for consistent LLM processing.
- **Gemini JSON Mode:** Calls Gemini with `responseMimeType: 'application/json'` for structured output.
- **Polling Pattern:** Frontend polls status endpoint until job completes or fails.
- **Fire-and-Forget:** Trigger returns immediately (202), worker runs async.

### Frontend Flow
| Component | Purpose |
|-----------|---------|
| `CreateAssignmentModal.tsx` | File selection, validation, base64 encoding, triggers extraction, polls status |
| `RubricPreviewModal.tsx` | Displays extracted content for review/edit |
| `lib/api/rubricJobs.ts` | API client with `startExtraction`, `checkStatus`, `pollJobStatus` helpers |

---

## Current GenAIWidgets State

### Existing RAG Preprocessing Infrastructure
- **Trigger:** `netlify/functions/extraction-trigger.ts`
- **Worker:** `netlify/functions/extraction-worker-background.ts`
  - Downloads blob from `user-files`
  - Loads prompt from `prompts` table via `getPromptConfig('extraction')`
  - Calls Gemini via AI Gateway (REST)
  - Chunks output → writes JSONL to `extracted-chunks`
  - Updates `blob_inventory`, `extraction_jobs`, `extraction_outputs`
- **Inventory:** `netlify/functions/extraction-inventory.ts`
- **Jobs:** `netlify/functions/extraction-jobs.ts`
- **Database Tables:** `blob_inventory`, `extraction_jobs`, `extraction_outputs`, `chunk_index`

### Current Issues
1. Extraction not reliably completing (needs investigation).
2. No Word→PDF conversion (may fail on `.docx` files).
3. Extraction prompt may need improvement for structured output.
4. UI feedback during extraction could be clearer.

---

## Improved Extraction Prompt

Store this prompt in the `prompts` table with `function_name = 'extraction'`:

```
You are an expert document analyst. Your task is to extract all structured content from a document and reformat it into a structured JSON object.

INPUT: A document that may contain tables, lists, sections, or other structured content.

CRITICAL: You MUST extract EACH distinct section/row/cell separately. Do NOT combine or concatenate content from different sections.

OUTPUT: A structured JSON object with the following format:
{
  "documentTitle": "<Title of the document, if available>",
  "language": "<primary language code, e.g., 'en'>",
  "sections": [
    {
      "sectionName": "<The name/heading of this section>",
      "content": "<VERBATIM text content for this section>",
      "subsections": [
        {
          "name": "<subsection name if applicable>",
          "content": "<VERBATIM content>"
        }
      ]
    }
  ],
  "tables": [
    {
      "tableName": "<Table caption or identifier>",
      "headers": ["<column1>", "<column2>", ...],
      "rows": [
        {
          "rowLabel": "<row identifier if present>",
          "cells": ["<cell1 content>", "<cell2 content>", ...]
        }
      ]
    }
  ],
  "metadata": {
    "pageCount": <number if known>,
    "hasImages": <boolean>,
    "extractionNotes": "<any warnings or notes about extraction quality>"
  }
}

EXTRACTION RULES:
1. Identify Document Title: Extract the main title if present.
2. Identify All Sections: Extract all major sections with their headings.
3. **TABLE PARSING CRITICAL**: If the document contains tables:
   - Each ROW is a separate entry
   - Each COLUMN/CELL contains distinct content
   - Extract the text from EACH CELL separately
   - Do NOT read across multiple columns or combine text from adjacent cells
4. Extract Content VERBATIM: Copy text exactly as it appears. Do NOT summarize or paraphrase.
5. Keep Items Separate: Each section/row/cell should contain ONLY its own content.
6. Preserve Original Wording: Maintain exact phrasing, punctuation, and formatting.
7. **VERIFY COMPLETENESS**: Count sections and table rows. Ensure all content is captured.

CRITICAL REQUIREMENTS:
- The structure MUST preserve the document's organization.
- Each content field MUST be copied VERBATIM from the source.
- Do NOT combine, merge, or concatenate content from different sections/cells.
- Do NOT summarize, shorten, or paraphrase any text.
```

---

## Implementation Plan

### Phase 1: Diagnose Current Issues
- [ ] Test current extraction pipeline end-to-end.
- [ ] Identify failure points (trigger? worker? Gemini call? output parsing?).
- [ ] Review logs for errors.
- [ ] Document specific issues found.

### Phase 2: Add Word→PDF Conversion (From AI-EssayGrader Pattern)
- [ ] Add `mammoth` and `pdf-lib` dependencies (if not present).
- [ ] Modify `extraction-worker-background.ts` to detect file type.
- [ ] For `.docx`/`.doc` files: extract text with `mammoth`, create PDF with `pdf-lib`.
- [ ] For `.pdf` files: use directly.
- [ ] Test with both PDF and Word documents.

### Phase 3: Improve Extraction Prompt
- [ ] Update the `prompts` table entry for `function_name = 'extraction'`.
- [ ] Use the improved prompt above (or adapt as needed).
- [ ] Ensure Gemini is called with `responseMimeType: 'application/json'`.
- [ ] Add server-side validation of the returned JSON structure.

### Phase 4: Fix Worker Reliability
Apply patterns from AI-EssayGrader's background worker:

- [ ] Ensure trigger returns 202 immediately (fire-and-forget pattern).
- [ ] Add proper error handling in worker:
  - Catch all errors
  - Update job status to 'failed' with sanitized error message
  - Never leave jobs stuck in 'processing'
- [ ] Add timeout handling (worker should complete or fail, not hang).
- [ ] Add correlation IDs for tracing trigger → worker.

### Phase 5: Improve UI Feedback
- [ ] Ensure status polling works correctly in `RagPreprocessingPage.tsx`.
- [ ] Add clearer progress indicators during extraction.
- [ ] Show meaningful error messages on failure.
- [ ] Add "Retry" functionality for failed extractions.
- [ ] **Add extraction preview/review modal** (confirmed requirement):
  - Create `ExtractionPreviewModal.tsx` component
  - Display extracted JSON content in readable format
  - Allow user to review before final save
  - Include Accept/Reject actions
  - Reference: `AI-EssayGrader/src/components/RubricPreviewModal.tsx`

### Phase 6: Ensure AI Gateway Compliance
- [ ] Verify all LLM calls are inside Netlify Functions only.
- [ ] Confirm functions use Netlify-injected env vars:
  - `GEMINI_API_KEY`
  - `GOOGLE_GEMINI_BASE_URL`
- [ ] Add startup check: fail fast if required env vars are missing.
- [ ] No client-side LLM keys.

### Phase 7: Testing & Validation
- [ ] Test extraction with PDF files.
- [ ] Test extraction with Word (.docx) files.
- [ ] Verify JSON output structure is correct.
- [ ] Verify content is extracted verbatim (not summarized).
- [ ] Test error handling (corrupt files, oversized files, etc.).
- [ ] Test concurrent extractions.

---

## Acceptance Criteria

- [ ] Uploading a PDF and clicking "Extract" results in a completed job with structured JSON output.
- [ ] Uploading a Word document (.docx) works the same way.
- [ ] Extraction produces verbatim content (no summarization/paraphrasing).
- [ ] Table content is parsed cell-by-cell (not merged across columns).
- [ ] Failed extractions show clear error messages.
- [ ] Retry functionality works for failed extractions.
- [ ] All LLM calls use AI Gateway (Netlify-injected env vars).

---

## Files to Modify (GenAIWidgets)

### Netlify Functions
- `netlify/functions/extraction-worker-background.ts` — Add Word→PDF conversion, improve error handling
- `netlify/functions/extraction-trigger.ts` — Verify fire-and-forget pattern

### Database
- `prompts` table — Update extraction prompt

### Frontend
- `src/pages/rag/RagPreprocessingPage.tsx` — Improve polling/status display
- `src/pages/rag/components/RagInventoryRow.tsx` — Improve status feedback
- `src/pages/rag/components/ExtractionPreviewModal.tsx` — **New: Preview/review modal for extracted content**

### Dependencies (if not present)
- `mammoth` — Word document text extraction
- `pdf-lib` — PDF creation from extracted text

---

## Open Questions

1. **Root cause of current failures?** — Need to diagnose before fixing.
2. ~~**Should extraction preview/review be added?**~~ — **YES, add a preview/review modal** (similar to AI-EssayGrader pattern).
3. **Chunking strategy changes needed?** — Current chunking may need adjustment based on new JSON structure.

---

## Reference Files (AI-EssayGrader - READ ONLY)

These files demonstrate working patterns. Do not modify; use for reference only:

- `AI-EssayGrader/netlify/functions/extract-rubric-trigger.ts`
- `AI-EssayGrader/netlify/functions/extract-rubric-background.ts`
- `AI-EssayGrader/netlify/functions/extract-rubric-status.ts`
- `AI-EssayGrader/netlify/functions/lib/rubric-job-storage.ts`
- `AI-EssayGrader/src/components/CreateAssignmentModal.tsx`
- `AI-EssayGrader/src/lib/api/rubricJobs.ts`
