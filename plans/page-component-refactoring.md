# Page Component Refactoring Plan

## Overview
Break down large page components (>300 lines) into smaller, reusable components for better maintainability and readability.

## Current Page Line Counts

| Page | Lines | Status |
|------|-------|--------|
| `HomePage.tsx` | 45 | ✅ OK |
| `DashboardPage.tsx` | 22 | ✅ OK |
| `LoginPage.tsx` | 103 | ✅ OK |
| `SignupPage.tsx` | 192 | ✅ OK |
| `AiGatewayChatPage.tsx` | 245 | ✅ OK |
| `RagPreprocessingPage.tsx` | 344 | ⚠️ Needs refactoring |
| `FilesPage.tsx` | 527 | ⚠️ Needs refactoring |
| `AdminPage.tsx` | 852 | ⚠️ Needs refactoring |

## Refactoring Targets

### 1. AdminPage.tsx (852 lines) → Target: ~150 lines

**Current Structure:**
- Tenants tab (create form, list, delete)
- Users tab (create form, list, toggle admin, delete)
- Memberships tab (create form, list, delete)
- Prompts tab (list, edit modal)

**Proposed Components:**

```
src/pages/admin/
├── AdminPage.tsx              (~150 lines) - Main page with tabs
├── components/
│   ├── TenantsTab.tsx         (~100 lines) - Tenant management
│   ├── UsersTab.tsx           (~120 lines) - User management
│   ├── MembershipsTab.tsx     (~100 lines) - Membership management
│   ├── PromptsTab.tsx         (~100 lines) - Prompts list
│   ├── PromptEditModal.tsx    (~120 lines) - Prompt edit modal
│   ├── CreateTenantForm.tsx   (~50 lines)  - Inline create form
│   ├── CreateUserForm.tsx     (~70 lines)  - Inline create form
│   └── CreateMembershipForm.tsx (~60 lines) - Inline create form
```

**Shared State:**
- Move API calls to custom hooks: `useAdminTenants`, `useAdminUsers`, `useAdminMemberships`, `useAdminPrompts`
- Pass data and handlers as props to tab components

---

### 2. FilesPage.tsx (527 lines) → Target: ~150 lines

**Current Structure:**
- Breadcrumb navigation
- Upload/Create folder buttons
- Folder list with actions
- File list with extraction status, view, download, delete
- File viewer modal integration

**Proposed Components:**

```
src/pages/files/
├── FilesPage.tsx              (~150 lines) - Main page with state
├── components/
│   ├── FilesBreadcrumb.tsx    (~40 lines)  - Path navigation
│   ├── FilesToolbar.tsx       (~60 lines)  - Upload, New Folder buttons
│   ├── FolderList.tsx         (~50 lines)  - Folder items
│   ├── FolderItem.tsx         (~40 lines)  - Single folder row
│   ├── FileList.tsx           (~50 lines)  - File items
│   ├── FileItem.tsx           (~80 lines)  - Single file row with actions
│   ├── CreateFolderForm.tsx   (~40 lines)  - Inline folder creation
│   └── ExtractionStatus.tsx   (~50 lines)  - Extraction status indicator
```

**Custom Hooks:**
- `useFiles(path)` - Fetch files/folders, handle CRUD
- `useFileExtraction()` - Handle extraction trigger/worker

---

### 3. RagPreprocessingPage.tsx (344 lines) → Target: ~100 lines

**Current Structure:**
- Stats cards
- Status filter buttons
- Inventory table with actions

**Proposed Components:**

```
src/pages/rag/
├── RagPreprocessingPage.tsx   (~100 lines) - Main page
├── components/
│   ├── RagStatsCards.tsx      (~50 lines)  - Stats dashboard
│   ├── RagStatusFilter.tsx    (~30 lines)  - Filter buttons
│   ├── RagInventoryTable.tsx  (~80 lines)  - Inventory table
│   └── RagInventoryRow.tsx    (~50 lines)  - Single row with actions
```

**Custom Hooks:**
- `useRagInventory(statusFilter)` - Fetch inventory
- `useRagStats()` - Fetch job stats

---

## Implementation Order

1. **AdminPage.tsx** (highest priority - 852 lines)
   - Extract PromptsTab and PromptEditModal first (newest code)
   - Then extract TenantsTab, UsersTab, MembershipsTab
   - Create shared hooks last

2. **FilesPage.tsx** (527 lines)
   - Extract FileItem and ExtractionStatus first
   - Then extract FolderItem, FileList, FolderList
   - Extract toolbar and breadcrumb
   - Create useFiles hook

3. **RagPreprocessingPage.tsx** (344 lines)
   - Extract RagStatsCards
   - Extract RagInventoryTable and RagInventoryRow
   - Create hooks

---

## Component Guidelines

### File Structure
- Each component in its own file
- Co-locate with parent page in `components/` subfolder
- Export from index.ts if needed

### Props Pattern
```typescript
interface ComponentProps {
  data: DataType[];
  onAction: (id: string) => Promise<void>;
  loading?: boolean;
}
```

### Hooks Pattern
```typescript
function useAdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => { ... }, []);
  const createTenant = useCallback(async (name: string) => { ... }, []);
  const deleteTenant = useCallback(async (id: string) => { ... }, []);

  return { tenants, loading, error, fetchTenants, createTenant, deleteTenant };
}
```

---

## Success Criteria

- [ ] No page file exceeds 300 lines
- [ ] Each extracted component is self-contained
- [ ] All existing tests still pass
- [ ] No functionality regression
- [ ] Consistent naming conventions
- [ ] TypeScript types properly defined

---

## Estimated Effort

| Page | Components to Create | Estimated Time |
|------|---------------------|----------------|
| AdminPage | 8 components + 4 hooks | ~2 hours |
| FilesPage | 8 components + 2 hooks | ~1.5 hours |
| RagPreprocessingPage | 4 components + 2 hooks | ~45 min |

**Total: ~4-5 hours**
