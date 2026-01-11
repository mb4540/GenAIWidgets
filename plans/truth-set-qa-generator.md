# Truth Set Q&A Generator for RAG Preprocessing

## Overview

Generate synthetic question-answer pairs from extracted document chunks to create a "truth set" for RAG evaluation and enhancement. Each chunk is sent to an LLM which generates Q&A pairs based on the content. Users can then approve, edit, or reject these pairs before they are vectorized into the same RAG collection as the source chunks.

## User Stories

1. **As a user**, I want to generate Q&A pairs from my extracted chunks so I can build a truth set for RAG evaluation.
2. **As a user**, I want to specify how many questions per chunk should be generated.
3. **As a user**, I want to review each generated Q&A pair and approve, edit, or reject it.
4. **As an admin**, I want to configure the LLM prompt used for Q&A generation.

## Architecture

### Data Flow

```
Extracted Chunks → LLM Q&A Generation → Review UI → Approved Q&A → Vectorization
                                              ↓
                                        Rejected Q&A → Deleted
```

### Database Schema

#### New Table: `chunk_qa_pairs`

```sql
CREATE TABLE chunk_qa_pairs (
  qa_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL,                    -- Reference to source chunk
  blob_id UUID NOT NULL,                     -- Reference to blob_inventory
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
  generated_by VARCHAR(100),                 -- Model that generated the Q&A
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(user_id),
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

CREATE INDEX idx_chunk_qa_blob ON chunk_qa_pairs(blob_id);
CREATE INDEX idx_chunk_qa_status ON chunk_qa_pairs(status);
CREATE INDEX idx_chunk_qa_tenant ON chunk_qa_pairs(tenant_id);
```

#### New Table: `qa_generation_jobs`

```sql
CREATE TABLE qa_generation_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blob_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  questions_per_chunk INTEGER NOT NULL DEFAULT 3,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
  total_chunks INTEGER,
  processed_chunks INTEGER DEFAULT 0,
  total_qa_generated INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(user_id)
);
```

### Prompt Configuration

Add a new prompt to the `prompts` table:

```sql
INSERT INTO prompts (
  function_name,
  display_name,
  description,
  model_provider,
  model_name,
  system_prompt,
  user_prompt_template,
  temperature,
  max_tokens,
  is_active
) VALUES (
  'generate_chunk_qa',
  'Chunk Q&A Generator',
  'Generates question-answer pairs from document chunks for RAG truth sets',
  'google',
  'gemini-2.0-flash',
  'You are an expert at creating high-quality question-answer pairs from document content. Generate questions that a user might naturally ask when searching for information contained in the provided text. Answers should be accurate, concise, and directly supported by the source text.',
  'Generate exactly {{questionsPerChunk}} question-answer pairs from the following document chunk.

Document Title: {{documentTitle}}
Section: {{sectionPath}}

Chunk Content:
{{chunkText}}

Return your response as a JSON array with this exact format:
[
  {"question": "...", "answer": "..."},
  {"question": "...", "answer": "..."}
]

Requirements:
- Questions should be natural and varied (who, what, when, where, why, how)
- Answers must be factually grounded in the chunk content
- Avoid yes/no questions
- Each Q&A pair should be self-contained and useful for retrieval',
  0.7,
  2000,
  true
);
```

---

## Implementation Phases

### Phase 1: Database & Prompt Setup
- [x] Create `chunk_qa_pairs` table migration
- [x] Create `qa_generation_jobs` table migration
- [x] Add seed prompt for Q&A generation to prompts table
- [ ] Verify prompt is editable in Admin console (requires migration run)

### Phase 2: Backend API - Q&A Generation
- [x] Create `qa-generate.ts` Netlify function
  - Accept blobId and questionsPerChunk parameters
  - Create job record in `qa_generation_jobs`
  - Fetch chunks from extraction output
  - For each chunk, call LLM with configured prompt
  - Parse JSON response and store Q&A pairs
  - Update job progress and status
- [x] Add error handling and retry logic
- [ ] Add rate limiting consideration for LLM calls

### Phase 3: Backend API - Q&A Management
- [x] Create `qa-list.ts` - List Q&A pairs for a blob (with status filter)
- [x] Create `qa-update.ts` - Update Q&A pair (edit question/answer, change status)
- [x] Create `qa-delete.ts` - Delete rejected Q&A pairs
- [x] Create `qa-bulk-approve.ts` - Approve multiple Q&A pairs at once

### Phase 4: Frontend - Generation UI
- [x] Add "Generate Q&A" button to extracted documents in RAG Preprocessing
- [x] Create Q&A generation modal with:
  - Questions per chunk slider/input (1-10, default 3)
  - Generate button
  - Progress indicator during generation
- [ ] Show generation job status (polling)

### Phase 5: Frontend - Review UI
- [x] Create Q&A Review page/modal
  - List all pending Q&A pairs grouped by chunk
  - Show source chunk text for context
  - For each Q&A pair:
    - Display question and answer
    - Approve button (green checkmark)
    - Edit button (opens inline edit mode)
    - Reject button (red X)
  - Bulk approve all button
  - Filter by status (pending, approved, rejected)
- [x] Add inline editing for questions and answers
- [x] Add confirmation for reject action

### Phase 6: Vectorization Integration
- [ ] Modify vectorization pipeline to include approved Q&A pairs
- [ ] Store Q&A pairs in same vector collection as source chunks
- [ ] Add metadata to distinguish Q&A from original chunks
- [ ] Update RAG retrieval to leverage Q&A pairs

### Phase 7: Polish & Testing
- [ ] Add toast notifications for actions
- [ ] Add keyboard shortcuts for review workflow
- [ ] Add statistics (total generated, approved rate, etc.)
- [ ] Write tests for API endpoints
- [ ] Write tests for UI components

---

## API Specifications

### POST /api/qa/generate

Generate Q&A pairs for a document's chunks.

**Request:**
```json
{
  "blobId": "uuid",
  "questionsPerChunk": 3
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "uuid",
  "message": "Q&A generation started"
}
```

### GET /api/qa/list?blobId={uuid}&status={pending|approved|rejected}

List Q&A pairs for a document.

**Response:**
```json
{
  "success": true,
  "qaPairs": [
    {
      "qaId": "uuid",
      "chunkIndex": 1,
      "chunkText": "...",
      "question": "...",
      "answer": "...",
      "status": "pending",
      "createdAt": "2026-01-11T..."
    }
  ],
  "stats": {
    "total": 18,
    "pending": 12,
    "approved": 5,
    "rejected": 1
  }
}
```

### PATCH /api/qa/update

Update a Q&A pair (edit or change status).

**Request:**
```json
{
  "qaId": "uuid",
  "question": "Updated question?",
  "answer": "Updated answer.",
  "status": "approved"
}
```

### DELETE /api/qa/delete?qaId={uuid}

Delete a rejected Q&A pair.

### POST /api/qa/bulk-approve

Approve multiple Q&A pairs at once.

**Request:**
```json
{
  "qaIds": ["uuid1", "uuid2", "uuid3"]
}
```

---

## UI Mockups

### Q&A Generation Modal

```
┌─────────────────────────────────────────────────────┐
│ Generate Q&A Truth Set                          [X] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Document: Product Manual.pdf                       │
│  Chunks: 12                                         │
│                                                     │
│  Questions per chunk: [3] ◄────────────────────►    │
│                        1                       10   │
│                                                     │
│  Total Q&A pairs to generate: 36                    │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ⚠️ This will call the LLM 12 times.         │   │
│  │ Estimated time: ~30 seconds                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│                    [Cancel]  [Generate Q&A]         │
└─────────────────────────────────────────────────────┘
```

### Q&A Review Interface

```
┌─────────────────────────────────────────────────────────────────┐
│ Review Q&A Pairs - Product Manual.pdf                       [X] │
├─────────────────────────────────────────────────────────────────┤
│ Filter: [All ▼]  Stats: 36 total | 24 pending | 10 approved    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ Chunk 1 ───────────────────────────────────────────────────┐│
│ │ "The ASC-100 LED Controller supports up to 16 zones..."    ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│   Q1: How many zones does the ASC-100 support?                 │
│   A:  The ASC-100 LED Controller supports up to 16 zones.      │
│                                        [✓ Approve] [✎] [✗]     │
│                                                                 │
│   Q2: What type of controller is the ASC-100?                  │
│   A:  The ASC-100 is an LED Controller.                        │
│                                        [✓ Approve] [✎] [✗]     │
│                                                                 │
│ ┌─ Chunk 2 ───────────────────────────────────────────────────┐│
│ │ "Installation requires a 12V DC power supply..."           ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│   Q1: What power supply is required for installation?          │
│   A:  Installation requires a 12V DC power supply.             │
│                                        [✓ Approve] [✎] [✗]     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [Approve All Pending] [Close]      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

### New Files
- `netlify/functions/qa-generate.ts`
- `netlify/functions/qa-list.ts`
- `netlify/functions/qa-update.ts`
- `netlify/functions/qa-delete.ts`
- `netlify/functions/qa-bulk-approve.ts`
- `src/pages/rag/components/QAGenerateModal.tsx`
- `src/pages/rag/components/QAReviewModal.tsx`
- `src/pages/rag/components/QAPairCard.tsx`

### Modified Files
- `src/pages/rag/RagPreprocessingPage.tsx` - Add Q&A generation button and review access
- `src/pages/rag/components/RagInventoryTable.tsx` - Add Q&A status column

---

## Considerations

### Performance
- Batch LLM calls where possible
- Consider background job processing for large documents
- Add progress tracking for long-running generation jobs

### Cost
- LLM calls per chunk can add up for large documents
- Consider adding cost estimation before generation
- Allow users to select specific chunks for Q&A generation

### Quality
- Prompt engineering is critical for good Q&A pairs
- Consider adding quality scoring or filtering
- Allow regeneration of individual Q&A pairs

### Security
- Ensure tenant isolation for all Q&A data
- Validate user permissions for approve/reject actions
- Sanitize Q&A content before storage

---

## Open Questions

1. Should Q&A pairs be editable after approval?
2. Should we support regenerating Q&A for a single chunk?
3. How should we handle chunks that produce invalid JSON from LLM?
4. Should we add a "skip" option in addition to approve/reject?
5. Should approved Q&A pairs be immediately vectorized or batched?

---

## Success Metrics

- Q&A pairs generated per document
- Approval rate (approved / total generated)
- Edit rate (edited before approval / total approved)
- Time to review (from generation to all reviewed)
- RAG retrieval improvement with Q&A augmentation
