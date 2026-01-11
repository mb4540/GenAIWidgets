# Extract UI Feature Plan

## Overview
Add extraction UI controls to the File Storage widget and create a new "RAG Preprocessing" widget to view and manage extracted files.

## Goals
- Add an "Extract" button to each file in the File Storage list
- Show extraction status on files (pending, processing, extracted, failed)
- Create a new RAG Preprocessing widget to view all extracted files and their chunks
- Provide visibility into the extraction pipeline
- **Move prompts to database** with model selection and function binding
- **Add Prompts tab to Admin page** for editing prompts

## Features

### 1. Extract Button in File Storage

**Location**: Left of the View (eye) icon in the file list

**Behavior**:
- Click triggers extraction for that file
- Shows loading spinner while processing
- Updates status indicator after completion
- Only visible for extractable file types (PDF, DOCX, XLSX, TXT, etc.)

**Status Indicators**:
| Status | Icon/Badge | Color |
|--------|------------|-------|
| Not extracted | Extract button (sparkles icon) | Gray |
| Pending | Clock icon | Yellow |
| Processing | Spinner | Blue |
| Extracted | Check icon | Green |
| Failed | X icon | Red |

### 2. RAG Preprocessing Widget

**New page**: `/rag-preprocessing`

**Sections**:

#### A. Dashboard Overview
- Total files in inventory
- Extraction status breakdown (pending/processing/extracted/failed)
- Recent extraction activity
- Token usage stats

#### B. Extracted Files Table
| Column | Description |
|--------|-------------|
| File Name | Original file name with icon |
| Status | Extraction status badge |
| Chunks | Number of chunks extracted |
| Extracted At | Timestamp |
| Actions | View chunks, Re-extract, Delete |

**Filters**:
- Status filter (All, Pending, Processing, Extracted, Failed)
- Date range
- File type
- Search by filename

#### C. Chunk Viewer (Modal/Drawer)
When clicking "View chunks" on a file:
- Show list of all chunks for that document
- Display chunk text with section path
- Show page numbers if available
- Quality confidence score

### 3. Navigation

Add to sidebar:
- Icon: `Layers` or `FileSearch` from Lucide
- Label: "RAG Preprocessing"
- Position: After "File Storage"
- Admin-only: No (visible to all authenticated users)

### 4. Prompts Management (Database-Driven)

Move hardcoded prompts to the database for easy editing without code changes.

#### Database Schema

```sql
CREATE TABLE prompts (
  prompt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  function_name VARCHAR(100) NOT NULL UNIQUE,  -- e.g., 'extraction', 'chat', 'summarize'
  display_name VARCHAR(255) NOT NULL,          -- e.g., 'Document Extraction'
  description TEXT,                            -- What this prompt does
  
  -- Model configuration
  model_provider VARCHAR(50) NOT NULL,         -- 'openai', 'anthropic', 'google'
  model_name VARCHAR(100) NOT NULL,            -- e.g., 'gpt-4', 'claude-3-sonnet', 'gemini-2.5-pro'
  
  -- Prompt content
  system_prompt TEXT,                          -- System/context prompt (optional)
  user_prompt_template TEXT NOT NULL,          -- User prompt with {{placeholders}}
  
  -- Model parameters
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(user_id)
);

-- Index for quick lookup by function
CREATE INDEX idx_prompts_function ON prompts(function_name);

-- Trigger for updated_at
CREATE TRIGGER trigger_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### Seed Data

```sql
INSERT INTO prompts (function_name, display_name, description, model_provider, model_name, user_prompt_template, temperature, max_tokens)
VALUES (
  'extraction',
  'Document Extraction',
  'Extracts structured text content from uploaded documents for RAG preprocessing',
  'google',
  'gemini-2.5-pro-preview-05-06',
  'Extract the text content from this document. Return a JSON object with:
- title: the document title if identifiable
- language: the primary language code (e.g., "en", "es", "fr")
- pages: an array of page objects, each with:
  - pageNumber: the page number (1-indexed)
  - text: the extracted text for that page
  - headings: any section headings found on that page

If the document doesn''t have clear pages (like a text file), return a single page with pageNumber 1.

Return ONLY valid JSON, no markdown formatting or explanation.',
  0.1,
  65536
);
```

#### Admin UI - Prompts Tab

Add a new "Prompts" tab to the Admin page.

**Table View**:
| Column | Description |
|--------|-------------|
| Function | Function name (extraction, chat, etc.) |
| Display Name | Human-readable name |
| Model | Provider + model name |
| Status | Active/Inactive toggle |
| Updated | Last modified timestamp |
| Actions | Edit, Duplicate, History |

**Edit Modal**:
```
┌─────────────────────────────────────────────────────────────────┐
│ Edit Prompt: Document Extraction                          [X]  │
├─────────────────────────────────────────────────────────────────┤
│ Function Name: extraction (read-only)                          │
│                                                                 │
│ Display Name: [Document Extraction                    ]        │
│                                                                 │
│ Description:                                                    │
│ [Extracts structured text content from uploaded...    ]        │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Model Provider    │ Model Name                              ││
│ │ [Google      ▼]   │ [gemini-2.5-pro-preview-05-06    ▼]    ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Temperature: [0.1]     │ Max Tokens: [65536]                ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ System Prompt (optional):                                       │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │                                                             ││
│ │                                                             ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ User Prompt Template:                                           │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Extract the text content from this document...             ││
│ │                                                             ││
│ │ Return ONLY valid JSON, no markdown formatting...          ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Available placeholders: {{file_name}}, {{mime_type}}, {{content}}│
│                                                                 │
│                              [Cancel]  [Save Changes]           │
└─────────────────────────────────────────────────────────────────┘
```

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/prompts` | GET | List all prompts |
| `/api/admin/prompts` | POST | Create new prompt |
| `/api/admin/prompts` | PUT | Update prompt (by function_name in body) |
| `/api/admin/prompts` | DELETE | Delete prompt (by function_name in query) |

#### Worker Integration

Modify `extraction-worker.ts` to fetch prompt from database:

```typescript
async function getPromptConfig(functionName: string): Promise<PromptConfig> {
  const sql = neon(DATABASE_URL);
  const result = await sql`
    SELECT * FROM prompts 
    WHERE function_name = ${functionName} AND is_active = true
  `;
  
  if (!result[0]) {
    throw new Error(`No active prompt found for function: ${functionName}`);
  }
  
  return {
    modelProvider: result[0].model_provider,
    modelName: result[0].model_name,
    systemPrompt: result[0].system_prompt,
    userPromptTemplate: result[0].user_prompt_template,
    temperature: result[0].temperature,
    maxTokens: result[0].max_tokens,
  };
}
```

## Implementation Plan

### Phase 1: Prompts Table and Admin UI ✅ COMPLETED
- [x] Create migration `005_prompts_table.sql`
  - Implemented in `migrations/005_prompts_table.sql`
- [x] Run migration on Neon database
- [x] Seed extraction prompt
  - `extraction` and `ai_chat` prompts seeded
- [x] Create `admin-prompts.ts` Netlify function (CRUD)
  - Full CRUD: GET, POST, PUT, DELETE
- [x] Add Prompts tab to AdminPage
  - `PromptsTab.tsx` component with list view
- [x] Create PromptEditModal component
  - `PromptEditModal.tsx` with all fields
- [x] Modify `extraction-worker.ts` to fetch prompt from database
  - `getPromptConfig()` function in `extraction-worker-background.ts`

### Phase 2: Extract Button in FilesPage ✅ COMPLETED
- [x] Add extraction status to file list API response
  - `files-list.ts` joins with `blob_inventory` for status
- [x] Create `getExtractionStatus` helper function
  - `ExtractionStatus.tsx` component handles all states
- [x] Add Extract button with sparkles icon
  - Sparkles icon from Lucide in `ExtractionStatus.tsx`
- [x] Implement click handler to call trigger + worker endpoints
  - `FileItem.tsx` passes `onExtract` to `ExtractionStatus`
- [x] Show status badges based on extraction state
  - pending (Clock/yellow), processing (Spinner/blue), extracted (Check/green), failed (X/red)
- [x] Add loading state during extraction
  - `isExtracting` prop shows spinner during extraction

### Phase 3: RAG Preprocessing Page ✅ COMPLETED
- [x] Create `RagPreprocessingPage.tsx` component
  - Full page at `src/pages/rag/RagPreprocessingPage.tsx`
- [x] Add route in `App.tsx`
  - Route: `/rag-preprocessing`
- [x] Add sidebar navigation item
  - `Layers` icon, "RAG Preprocessing" label in `AppLayout.tsx`
- [x] Implement dashboard stats section
  - `RagStatsCards.tsx` with Total, Pending, Extracted, Failed counts
- [x] Implement extracted files table with pagination
  - `RagInventoryTable.tsx` + `RagInventoryRow.tsx`
- [x] Add status filters and search
  - `RagStatusFilter.tsx` with All/Pending/Processing/Extracted/Failed buttons
- [x] Create chunk viewer modal
  - `ExtractionPreviewModal.tsx` for viewing extracted content

### Phase 4: API Enhancements ✅ COMPLETED
- [x] Modify `files-list` to include extraction status from blob_inventory
  - `files-list.ts` returns `extractionStatus` and `chunkCount`
- [x] Add endpoint to get chunks for a document
  - `extraction-content.ts` - GET `/api/extraction/content?blobId=`
- [x] Add endpoint to re-trigger extraction
  - `extraction-trigger.ts` - POST `/api/extraction/trigger` with `blobId`

### Phase 5: Polish (Partial)
- [ ] Add toast notifications for extraction status
- [x] Add bulk extraction action
  - "Process All Pending" button in `RagPreprocessingPage.tsx`
- [ ] Add extraction progress indicator
- [x] Error handling and retry UI
  - Failed status shows retry button in `ExtractionStatus.tsx`
  - Re-extract button in `RagInventoryRow.tsx`

## UI Mockups

### File List Row with Extract Button
```
┌─────────────────────────────────────────────────────────────────┐
│ 📄 document.pdf                              ✨ 👁 ⬇ 🗑        │
│    1.2 MB • 1/10/2026                        │                  │
└─────────────────────────────────────────────────────────────────┘
     ↑ file info                               ↑ Extract, View, Download, Delete
```

### After Extraction
```
┌─────────────────────────────────────────────────────────────────┐
│ 📄 document.pdf                         ✓ 42 👁 ⬇ 🗑           │
│    1.2 MB • 1/10/2026                   chunks                  │
└─────────────────────────────────────────────────────────────────┘
     ↑ file info                          ↑ Extracted badge with chunk count
```

### RAG Preprocessing Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│ RAG Preprocessing                                               │
│ Manage extracted files and chunks for retrieval                 │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │   124    │ │    12    │ │     3    │ │     2    │            │
│ │  Total   │ │ Pending  │ │Processing│ │  Failed  │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
├─────────────────────────────────────────────────────────────────┤
│ [All ▼] [Status ▼] [Date ▼]                    🔍 Search...    │
├─────────────────────────────────────────────────────────────────┤
│ File Name          │ Status    │ Chunks │ Extracted   │ Actions│
│────────────────────┼───────────┼────────┼─────────────┼────────│
│ 📄 report.pdf      │ ✓ Done    │   42   │ 2 hours ago │ 👁 🔄  │
│ 📊 data.xlsx       │ ✓ Done    │   18   │ 3 hours ago │ 👁 🔄  │
│ 📝 notes.docx      │ ⏳ Pending │   -    │     -       │ ▶️     │
│ 📄 contract.pdf    │ ❌ Failed  │   -    │ 1 hour ago  │ 🔄     │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Notes

### Extraction Status Flow
1. File uploaded → `blob_inventory.status = 'pending'`
2. Extract clicked → Call `/api/extraction/trigger` → `status = 'processing'`
3. Worker runs → Call `/api/extraction/worker` → `status = 'extracted'` or `'failed'`

### Joining Files with Extraction Status
```sql
SELECT 
  f.*,
  bi.status AS extraction_status,
  bi.blob_id AS inventory_id,
  (SELECT chunk_count FROM extraction_jobs ej 
   WHERE ej.blob_id = bi.blob_id AND ej.status = 'completed'
   ORDER BY completed_at DESC LIMIT 1) AS chunk_count
FROM files f
LEFT JOIN blob_inventory bi ON f.blob_key = bi.blob_key
WHERE f.file_path = $1 AND f.tenant_id = $2
```

## Dependencies
- Existing extraction API endpoints
- blob_inventory, extraction_jobs tables
- **New**: prompts table
- Lucide icons: Sparkles, Clock, Check, X, Layers, MessageSquare

## Open Questions (Resolved)
- Should extraction be automatic on upload? → **Currently manual** (implemented)
- Should we show extraction cost/token estimates before extracting? → **Not implemented**
- Bulk extraction limit per request? → **100 files per batch** (in `extraction-trigger.ts`)
