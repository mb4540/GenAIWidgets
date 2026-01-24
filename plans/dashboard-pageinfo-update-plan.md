# Dashboard & Page Info Update Plan

## Overview

Update the dashboard to represent all application features and ensure all pages have the PageInfoModal "Details" button. Also add info and download functionality to the DebugPanel.

---

## Current State Analysis

### Pages WITH PageInfoModal (have Details button):
1. `DashboardPage.tsx` - ✅ Has it (dashboardInfo.ts)
2. `AdminPage.tsx` - ✅ Has it (adminInfo.ts)
3. `AgentManagementPage.tsx` - ✅ Has it (agentManagementInfo.ts)
4. `ToolsManagementPage.tsx` - ✅ Has it (toolsManagementInfo.ts)
5. `AiGatewayChatPage.tsx` - ✅ Has it (chatInfo.ts)
6. `FilesPage.tsx` - ✅ Has it (filesInfo.ts)
7. `RagPreprocessingPage.tsx` - ✅ Has it (ragInfo.ts)

### Pages WITHOUT PageInfoModal (need to add):
1. `AiChatPage.tsx` - ❌ Missing
2. `AgentChatPage.tsx` - ❌ Missing
3. `MemoryManagementPage.tsx` - ❌ Missing

### Components needing updates:
1. `DebugPanel.tsx` - Add info button + download all button

---

## Dashboard Updates

Current dashboard shows:
- Files count
- Extractions count
- Chunks count
- Q&A Pairs count
- Recent Activity

Missing from dashboard:
- AI Chat sessions count
- Agent Chat sessions count
- Agents count
- Agent Tools count
- Blob storage info (admin only)

### New Stats Cards to Add:
1. **AI Chat Sessions** - Count of user's AI chat sessions
2. **Agent Sessions** - Count of agent chat sessions
3. **Agents** - Count of configured agents
4. **Tools** - Count of available agent tools

---

## Implementation Tasks

### Task 1: Update Dashboard Stats API
**File:** `netlify/functions/dashboard-stats.ts`

Add queries for:
- AI chat sessions count
- Agent sessions count
- Agents count
- Agent tools count

### Task 2: Update DashboardPage UI
**File:** `src/pages/dashboard/DashboardPage.tsx`

- Add new stat cards for AI Chat, Agents, Tools
- Update grid layout (2 rows of 4 cards)
- Update dashboardInfo.ts with new features

### Task 3: Add PageInfoModal to AiChatPage
**Files:**
- `src/pages/ai-chat/AiChatPage.tsx`
- `src/pages/ai-chat/aiChatInfo.ts` (new)

### Task 4: Add PageInfoModal to AgentChatPage
**Files:**
- `src/pages/agent-chat/AgentChatPage.tsx`
- `src/pages/agent-chat/agentChatInfo.ts` (new)

### Task 5: Add PageInfoModal to MemoryManagementPage
**Files:**
- `src/pages/agent-chat/MemoryManagementPage.tsx`
- `src/pages/agent-chat/memoryManagementInfo.ts` (new)

### Task 6: Update DebugPanel
**File:** `src/components/agent-chat/DebugPanel.tsx`

- Add Info button with modal explaining debug panel
- Add "Download All" button to export debug data as .txt file

---

## Estimated Effort

| Task | Time |
|------|------|
| Dashboard Stats API | 30 min |
| Dashboard UI Update | 30 min |
| AiChatPage Info | 20 min |
| AgentChatPage Info | 20 min |
| MemoryManagementPage Info | 20 min |
| DebugPanel Updates | 30 min |
| Testing | 20 min |
| **Total** | **~3 hours** |

---

## Execution Order

1. Update dashboard-stats.ts API
2. Update DashboardPage.tsx with new cards
3. Create info files and add PageInfoModal to missing pages
4. Update DebugPanel with info and download
5. Test all changes
6. Commit

---

*Plan created for comprehensive dashboard and page info updates.*
