# Extraction Remaining Tasks

## Overview
Consolidated remaining tasks from the completed blob-text-extraction and extract-ui-feature plans.

## Post-Processing & Normalization

- [ ] Normalize whitespace and hyphenation artifacts
- [ ] Remove repeated headers/footers where detected
- [ ] Optional PII redaction hook (pluggable)

## Schema & Output Enhancements

- [ ] Implement schema validation (fail closed) for chunk JSONL output
- [ ] Write doc-level JSON record (optional document summary)

## Dataiku Integration

- [ ] Ingest JSONL as a Dataiku dataset (row-per-chunk)
- [ ] Build/validate:
  - Text-prep recipe to ensure consistent casing/whitespace rules
  - Optional embedding recipe / vector index (depending on Dataiku setup)
- [ ] Evaluate retrieval match rates
  - Test queries, top-k relevance checks
  - Analyze failure modes (chunk size too small/large, missing headers, noisy artifacts)

## Operations & Maintenance

- [ ] Reprocessing workflow when prompts/models change
- [ ] Blob inventory sync job (discover new files, mark deleted)
- [ ] Stale extraction detection (re-extract when model/prompt changes)

## UI Polish

- [ ] Add toast notifications for extraction status
- [ ] Add extraction progress indicator

## Source Plans (Completed)
- `blob-text-extraction-gemini-dataiku.md` → moved to `completedPlans/`
- `extract-ui-feature.md` → moved to `completedPlans/`
