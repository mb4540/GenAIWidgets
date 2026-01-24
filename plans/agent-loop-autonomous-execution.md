# Agent Loop Autonomous Execution Enhancement

## Problem Statement

The current agent loop in `agent-loop-background.ts` breaks execution whenever the LLM responds without tool calls, even if the agent hasn't completed its goal. This forces the user to send another message to continue, breaking the autonomous workflow.

**Current behavior** (lines 438-456):
```typescript
} else {
  // Regular response without tool calls
  // ... save message ...
  
  // If no tool calls and not goal complete, we're waiting for user input
  break;  // <-- PROBLEM: Always breaks, even mid-task
}
```

**Example**: Agent says "Let me explore the subdirectories..." but then stops and waits for user input instead of actually calling the `list_files` tool.

---

## Root Cause Analysis

1. **No continuation signal**: The loop has no way to distinguish between:
   - Agent thinking/planning (should continue)
   - Agent asking a question (should wait for user)
   - Agent providing final answer (should complete)

2. **Missing "thinking" loop**: Modern agentic patterns allow the LLM to reason/plan in one turn, then act in the next, without user intervention.

3. **Single-turn assumption**: The current design assumes each LLM call should either use tools OR wait for user input.

---

## Proposed Solution: Plan-Based Execution with Short-Term Memory (Option C)

### Overview

Implement a **plan-driven agent loop** where every agent must:
1. Create an execution plan stored in **session short-term memory**
2. Execute the plan step-by-step, updating memory as each step completes
3. Continue until all plan steps are complete OR max iterations reached

This leverages the existing memory management system and integrates with the Admin Dashboard Prompts tab for centralized prompt management.

### Key Components

1. **New `update_plan` builtin tool** - Agent calls this to create/update its execution plan
2. **Session short-term memory table** - Stores the current plan for each session
3. **Admin-managed Agent Planning System Prompt** - Configurable via Prompts tab
4. **Loop continuation logic** - Checks plan status to determine if agent should continue

---

## Architecture

### Existing Infrastructure to Leverage

| Component | Location | Purpose |
|-----------|----------|---------|
| Long-term memory | `agent_long_term_memory` table | Persistent facts across sessions |
| Session messages | `agent_session_messages` table | Conversation history |
| Prompts management | `prompts` table + Admin Prompts tab | Centralized prompt configuration |
| Memory Management UI | `src/pages/agent-chat/MemoryManagementPage.tsx` | View/edit agent memories |

### New Components Required

| Component | Location | Purpose |
|-----------|----------|---------|
| Session short-term memory | `agent_session_memory` table (NEW) | Per-session working memory including plan |
| `update_plan` tool | Builtin tool in `agent_tools` | Agent updates its execution plan |
| Agent Planning Prompt | `prompts` table entry | System prompt requiring plan creation |

---

## Database Schema Changes

### Database Design Compliance (per database-design.md)

**Pre-requisites:**
- [ ] Consult `/db_ref.md` before creating migration
- [ ] Update `/db_ref.md` after migration is applied
- [ ] Update TypeScript types in `src/types/agent.ts`

**Design Standards Applied:**
- UUID primary key with `gen_random_uuid()`
- `TIMESTAMPTZ` for all timestamps (with timezone)
- snake_case for table and column names
- Foreign key with explicit `ON DELETE CASCADE`
- Indexes on foreign key columns (not automatic in PostgreSQL)
- `JSONB` for flexible schema (plan data)

### New Table: `agent_session_memory`

```sql
-- Migration: 015_agent_session_memory.sql
-- Description: Short-term working memory for agent sessions (plan tracking, scratchpad)
-- Created: 2026-01-24
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_session_memory_key;
--   DROP INDEX IF EXISTS idx_session_memory_session_id;
--   DROP TABLE IF EXISTS agent_session_memory;

CREATE TABLE IF NOT EXISTS agent_session_memory (
    memory_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID NOT NULL,
    memory_key    TEXT NOT NULL,           -- e.g., 'execution_plan', 'scratchpad'
    memory_value  JSONB NOT NULL,          -- Structured data (plan, notes, etc.)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Foreign key with CASCADE: memory deleted when session deleted
    CONSTRAINT fk_session_memory_session
        FOREIGN KEY (session_id) 
        REFERENCES agent_sessions(session_id) 
        ON DELETE CASCADE,

    -- Unique constraint: one value per key per session
    CONSTRAINT agent_session_memory_unique_key
        UNIQUE (session_id, memory_key)
);

-- Index on foreign key (required per database-design.md - not automatic)
CREATE INDEX IF NOT EXISTS idx_session_memory_session_id 
    ON agent_session_memory(session_id);

-- Composite index for key lookups within session
CREATE INDEX IF NOT EXISTS idx_session_memory_session_key 
    ON agent_session_memory(session_id, memory_key);

-- Add updated_at trigger
CREATE TRIGGER update_agent_session_memory_updated_at
    BEFORE UPDATE ON agent_session_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agent_session_memory IS 'Short-term working memory for agent sessions';
COMMENT ON COLUMN agent_session_memory.memory_key IS 'Key identifier: execution_plan, scratchpad, etc.';
COMMENT ON COLUMN agent_session_memory.memory_value IS 'JSONB structured data for the memory entry';
```

### Required `/db_ref.md` Update

After migration, add to `/db_ref.md`:

```markdown
## agent_session_memory

Short-term working memory for agent sessions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| memory_id | UUID | NO | gen_random_uuid() | Primary key |
| session_id | UUID | NO | - | FK to agent_sessions |
| memory_key | TEXT | NO | - | Key identifier |
| memory_value | JSONB | NO | - | Structured data |
| created_at | TIMESTAMPTZ | NO | now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NO | now() | Last update timestamp |

**Indexes:**
- `idx_session_memory_session_id` on (session_id)
- `idx_session_memory_session_key` on (session_id, memory_key)

**Foreign Keys:**
- session_id → agent_sessions(session_id) ON DELETE CASCADE

**Constraints:**
- agent_session_memory_unique_key: UNIQUE(session_id, memory_key)
```

### Plan Structure (stored in `memory_value`)

**Code Quality Compliance (per code-quality.md):**
- Use interfaces for object shapes
- Use discriminated unions for status fields
- Prefer `readonly` for immutable properties
- No `any` types - use proper typing throughout

```typescript
// src/types/agent.ts - Add these types

/** Plan status discriminated union */
type PlanStatus = 'planning' | 'executing' | 'completed' | 'failed' | 'waiting_for_user';

/** Step status discriminated union */
type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/** Individual step in an execution plan */
interface PlanStep {
  readonly step_number: number;
  readonly description: string;
  status: StepStatus;
  result?: string;
  completed_at?: string;
}

/** Execution plan stored in session memory */
interface ExecutionPlan {
  readonly created_at: string;
  updated_at: string;
  readonly goal: string;
  steps: readonly PlanStep[];
  current_step_index: number;
  status: PlanStatus;
}

/** Session memory row from database */
interface SessionMemoryRow {
  memory_id: string;
  session_id: string;
  memory_key: string;
  memory_value: unknown;  // Use unknown, narrow when accessing
  created_at: string;
  updated_at: string;
}
```

---

## New Builtin Tool: `update_plan`

### Tool Definition (to be added to `agent_tools` table)

```json
{
  "name": "update_plan",
  "description": "Create or update your execution plan. You MUST call this tool at the start of every task to create a plan, and after completing each step to mark progress. The plan is stored in session memory and guides your autonomous execution.",
  "tool_type": "builtin",
  "input_schema": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["create", "update_step", "complete", "fail", "wait_for_user"],
        "description": "The action to perform on the plan"
      },
      "goal": {
        "type": "string",
        "description": "The goal you are trying to accomplish (required for 'create' action)"
      },
      "steps": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "step_number": { "type": "integer" },
            "description": { "type": "string" }
          }
        },
        "description": "The steps to accomplish the goal (required for 'create' action)"
      },
      "step_number": {
        "type": "integer",
        "description": "The step number to update (required for 'update_step' action)"
      },
      "step_status": {
        "type": "string",
        "enum": ["in_progress", "completed", "failed", "skipped"],
        "description": "The new status for the step (required for 'update_step' action)"
      },
      "step_result": {
        "type": "string",
        "description": "Summary of what happened in this step (optional for 'update_step')"
      },
      "reason": {
        "type": "string",
        "description": "Reason for completion/failure/waiting (required for 'complete', 'fail', 'wait_for_user')"
      }
    },
    "required": ["action"]
  }
}
```

### Tool Implementation

Add to `BUILTIN_TOOL_ENDPOINTS` in `agent-loop-background.ts`:
```typescript
const BUILTIN_TOOL_ENDPOINTS: Record<string, string> = {
  get_weather: '/api/tools/weather',
  list_files: '/api/tools/files',
  read_file: '/api/tools/files',
  create_file: '/api/tools/files',
  delete_file: '/api/tools/files',
  update_plan: '/api/tools/plan',  // NEW
};
```

New function file: `netlify/functions/tool-plan.ts`

### API Design Compliance (per api-design.md)

The `tool-plan.ts` endpoint must follow these API design rules:

**Response Structure:**
```typescript
// Success response
interface SuccessResponse<T> {
  success: true;
  data: T;
}

// Error response
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
```

**Error Codes:**
```typescript
const PlanErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  INVALID_ACTION: 'INVALID_ACTION',
  STEP_NOT_FOUND: 'STEP_NOT_FOUND',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

**HTTP Status Codes:**
| Scenario | Status Code |
|----------|-------------|
| Plan created | 201 |
| Plan updated | 200 |
| Invalid input | 400 |
| Session not found | 404 |
| Server error | 500 |

**Required Security Headers:**
```typescript
const securityHeaders = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
```

**Input Validation Requirements:**
- Validate `action` is one of allowed values
- Validate `steps` array has 1-10 items for create action
- Validate `step_number` exists in plan for update_step action
- Validate `goal` is non-empty string for create action
- Return 400 with specific validation errors

### Security Compliance (per security.md)

**Environment Variable Validation:**
```typescript
// Validate required env vars at function startup
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  // Never expose which env var is missing to client
  console.error('[tool-plan] Missing DATABASE_URL');
  return createErrorResponse('Server configuration error', 500);
}
```

**Authorization Requirements:**
- Verify session belongs to authenticated user's tenant
- Check tenant membership before any plan operations
- Never trust client-provided tenant IDs

```typescript
// Authorization check pattern
const session = await sql`
  SELECT session_id, tenant_id FROM agent_sessions 
  WHERE session_id = ${sessionId}
`;

if (!session[0]) {
  return createErrorResponse('Session not found', 404);
}

// Verify tenant ownership
if (session[0].tenant_id !== authContext.tenantId && !authContext.isAdmin) {
  // Log security event (without sensitive data)
  console.warn('[tool-plan] Unauthorized access attempt', { 
    userId: authContext.userId,
    attemptedSessionId: sessionId 
  });
  return createErrorResponse('Forbidden', 403);
}
```

**Logging Rules (What to NEVER Log):**
- Plan content (may contain user data)
- Session IDs in combination with user data
- Full request/response bodies
- JWT tokens

**Logging Rules (What to Log):**
- Authentication events (success/failure)
- Authorization failures (sanitized)
- Plan status changes (without content)
- Error events (without sensitive context)

```typescript
// Safe logging example
console.log('[tool-plan] Plan created', { 
  sessionId,  // OK - not sensitive alone
  stepCount: plan.steps.length,  // OK - metadata only
  // NEVER: planContent, userMessage, etc.
});
```

---

## Admin-Managed Agent Planning System Prompt

### Prompt Entry for `prompts` Table

| Field | Value |
|-------|-------|
| `function_name` | `agent_planning_system` |
| `display_name` | Agent Planning System Prompt |
| `description` | System prompt that instructs agents to create and follow execution plans |
| `model_provider` | (varies by agent) |
| `model_name` | (varies by agent) |
| `system_prompt` | See below |
| `user_prompt_template` | `{user_message}` |
| `is_active` | `true` |

### System Prompt Content

```markdown
## Execution Model

You are an autonomous agent that operates by creating and following execution plans. You MUST follow this workflow for every task:

### 1. PLANNING PHASE (Required First Step)
When you receive a new task from the user, you MUST:
1. Analyze the request to understand what needs to be accomplished
2. Call the `update_plan` tool with action="create" to create your execution plan
3. Break down the task into clear, actionable steps (typically 3-7 steps)
4. Each step should be specific and achievable with your available tools

### 2. EXECUTION PHASE
After creating your plan:
1. Call `update_plan` with action="update_step" to mark the current step as "in_progress"
2. Execute the step using appropriate tools
3. Call `update_plan` with action="update_step" to mark the step as "completed" with a result summary
4. Move to the next step
5. Repeat until all steps are complete

### 3. COMPLETION
When all steps are done:
- Call `update_plan` with action="complete" and provide a summary
- Then respond with "GOAL_COMPLETE" followed by your final summary to the user

### 4. HANDLING ISSUES
- If you need user input: Call `update_plan` with action="wait_for_user" and explain what you need
- If a step fails: Call `update_plan` with action="update_step", status="failed", then either retry or adjust your plan
- If the entire task cannot be completed: Call `update_plan` with action="fail" with the reason

### Rules
- NEVER skip the planning phase - always create a plan first
- NEVER say you will do something without actually doing it
- ALWAYS update your plan status after each action
- Keep steps atomic and verifiable
- If you realize your plan needs adjustment, you can create a new plan

### Example Plan Creation
For "List all files and summarize their contents":
```json
{
  "action": "create",
  "goal": "List all files and summarize their contents",
  "steps": [
    { "step_number": 1, "description": "List files in root directory" },
    { "step_number": 2, "description": "Explore each subdirectory to find all files" },
    { "step_number": 3, "description": "Read content of each text-based file" },
    { "step_number": 4, "description": "Create summary of all file contents" }
  ]
}
```
```

---

## Updated Agent Loop Logic

### AI Gateway Compliance (per ai-gateway.md)

The agent loop must follow these AI Gateway rules:

1. **Use official client libraries** - OpenAI, Anthropic SDKs (already implemented in `llm-client.ts`)
2. **Rely on auto-injected environment variables** - No hardcoded API keys
3. **Implement rate limiting** - Add per-session rate limiting
4. **Handle API errors gracefully** - Implement retry with backoff for 429 errors
5. **Set reasonable max_tokens limits** - Prevent runaway token usage
6. **Never log prompts or outputs** - Sanitize error logs
7. **Sanitize user input** - Prevent prompt injection

### Modified `agent-loop-background.ts`

```typescript
// Constants
const MAX_CONSECUTIVE_NON_TOOL_RESPONSES = 3;
const MAX_TOKENS_PER_CALL = 4096;  // AI Gateway: Set reasonable limits
const MAX_TOKENS_PER_SESSION = 50000;  // AI Gateway: Cost management

// AI Gateway: Rate limiting per session
interface SessionRateLimit {
  tokenCount: number;
  lastReset: number;
}
const sessionTokenUsage = new Map<string, SessionRateLimit>();

function checkSessionTokenBudget(sessionId: string, tokensUsed: number): boolean {
  const now = Date.now();
  const windowMs = 3600000; // 1 hour window
  
  const usage = sessionTokenUsage.get(sessionId);
  if (!usage || now > usage.lastReset + windowMs) {
    sessionTokenUsage.set(sessionId, { tokenCount: tokensUsed, lastReset: now });
    return true;
  }
  
  if (usage.tokenCount + tokensUsed > MAX_TOKENS_PER_SESSION) {
    return false; // Budget exceeded
  }
  
  usage.tokenCount += tokensUsed;
  return true;
}

// AI Gateway: Sanitize user input for prompts (prevent injection)
function sanitizeForPrompt(userInput: string): string {
  return userInput
    .replace(/```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, 10000); // Limit length
}

// Neon Database Compliance (per neon-database.md)
// - Use @neondatabase/serverless package
// - Create new connection per function invocation (already done in handler)
// - Use parameterized queries (template literals)
// - Never cache connections across invocations
// - Validate DATABASE_URL exists before use

import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Type-safe helper for session plan retrieval
async function getSessionPlan(
  sql: NeonQueryFunction,
  sessionId: string
): Promise<ExecutionPlan | null> {
  // Parameterized query - sessionId is safely interpolated
  const result = await sql`
    SELECT memory_value FROM agent_session_memory
    WHERE session_id = ${sessionId} AND memory_key = 'execution_plan'
  ` as { memory_value: unknown }[];
  
  // Type narrowing per code-quality.md (use unknown, not any)
  const row = result[0];
  if (!row?.memory_value) return null;
  
  // Validate the shape before returning
  const plan = row.memory_value as ExecutionPlan;
  if (!plan.goal || !Array.isArray(plan.steps)) {
    console.error('[getSessionPlan] Invalid plan structure');
    return null;
  }
  
  return plan;
}

function shouldContinueBasedOnPlan(plan: ExecutionPlan | null): boolean {
  if (!plan) return false;  // No plan = wait for user
  
  if (plan.status === 'waiting_for_user') return false;
  if (plan.status === 'completed') return false;
  if (plan.status === 'failed') return false;
  
  // Check if there are pending steps
  const hasIncompleteSteps = plan.steps.some(
    step => step.status === 'pending' || step.status === 'in_progress'
  );
  
  return hasIncompleteSteps;
}

// In the main loop, replace the else block:
} else {
  // Regular response without tool calls
  await saveMessage(
    sql, sessionId, currentStep, 'assistant',
    llmResponse.content || '',
    undefined, undefined, undefined,
    llmResponse.reasoning || undefined, llmResponse.tokens_used
  );

  conversationMessages.push({
    role: 'assistant',
    content: llmResponse.content || '',
  });

  // Check plan status to determine if we should continue
  const plan = await getSessionPlan(sql, sessionId);
  const shouldContinue = shouldContinueBasedOnPlan(plan);
  
  if (shouldContinue && consecutiveNonToolResponses < MAX_CONSECUTIVE_NON_TOOL_RESPONSES) {
    consecutiveNonToolResponses++;
    await updateSessionStatus(sql, sessionId, 'active', currentStep);
    // Continue the loop - agent has more plan steps to execute
  } else {
    consecutiveNonToolResponses = 0;
    await updateSessionStatus(sql, sessionId, 'active', currentStep);
    break; // Wait for user input or plan is complete
  }
}
```

### Modified `buildSystemPrompt` Function

```typescript
async function buildSystemPrompt(
  sql: any,
  agent: AgentRow, 
  memories: MemoryRow[],
  sessionId: string
): Promise<string> {
  // Fetch the agent planning system prompt from prompts table
  const planningPromptResult = await sql`
    SELECT system_prompt FROM prompts 
    WHERE function_name = 'agent_planning_system' AND is_active = true
  `;
  const planningPrompt = planningPromptResult[0]?.system_prompt || '';

  // Fetch current session plan if exists
  const plan = await getSessionPlan(sql, sessionId);

  let prompt = agent.system_prompt;
  
  // Add planning instructions
  if (planningPrompt) {
    prompt += `\n\n${planningPrompt}`;
  }

  prompt += `\n\n## Your Goal\n${agent.goal}`;

  // Add current plan status if exists
  if (plan) {
    prompt += `\n\n## Current Execution Plan\n`;
    prompt += `**Goal:** ${plan.goal}\n`;
    prompt += `**Status:** ${plan.status}\n`;
    prompt += `**Steps:**\n`;
    for (const step of plan.steps) {
      const statusIcon = {
        'pending': '⬜',
        'in_progress': '🔄',
        'completed': '✅',
        'failed': '❌',
        'skipped': '⏭️'
      }[step.status] || '⬜';
      prompt += `${statusIcon} ${step.step_number}. ${step.description}`;
      if (step.result) {
        prompt += ` - ${step.result}`;
      }
      prompt += '\n';
    }
  }

  if (memories.length > 0) {
    prompt += '\n\n## Relevant Long-Term Memories\n';
    for (const memory of memories) {
      prompt += `- [${memory.memory_type}] ${memory.content}\n`;
    }
  }

  return prompt;
}
```

---

## Implementation Plan

### Phase 1: Database & Tool Setup (2-3 hours)

1. **Create migration for `agent_session_memory` table**
   - File: `migrations/015_agent_session_memory.sql`

2. **Add `update_plan` builtin tool to database**
   - Insert into `agent_tools` table
   - Add to system tools that are auto-assigned to agents

3. **Implement `tool-plan.ts` endpoint**
   - File: `netlify/functions/tool-plan.ts`
   - Handle create, update_step, complete, fail, wait_for_user actions

### Phase 2: Agent Loop Updates (2-3 hours)

1. **Add session memory helper functions**
   - `getSessionPlan()`, `shouldContinueBasedOnPlan()`

2. **Update loop continuation logic**
   - Check plan status instead of unconditional break

3. **Update `buildSystemPrompt` to include plan status**
   - Fetch and inject current plan into context

4. **Add `update_plan` to `BUILTIN_TOOL_ENDPOINTS`**

### Phase 3: Admin Prompt Configuration (1 hour)

1. **Create Agent Planning System Prompt entry**
   - Add to `prompts` table via migration or seed script
   - Configure in Admin Dashboard Prompts tab

2. **Document prompt customization options**
   - How admins can modify the planning behavior

### Phase 4: UI Enhancements (2-3 hours)

#### Frontend Components Compliance (per frontend-components.md)

**Component Requirements:**
- Use shadcn/ui components (Card, Badge, Progress)
- TypeScript interfaces for all props
- Use `cn()` helper for conditional classes
- Tailwind CSS with proper class organization (layout → sizing → typography → visual → interactive)
- Accessibility: ARIA labels, keyboard navigation, semantic HTML
- Handle loading and error states
- Max 200 lines per component file

1. **Display current plan in Agent Chat UI**
   - Show plan steps with status indicators
   - Real-time updates as steps complete

2. **Add plan visualization component**
   - File: `src/components/agent-chat/PlanProgress.tsx`

```typescript
// src/components/agent-chat/PlanProgress.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2, XCircle, SkipForward } from 'lucide-react';

import type { ExecutionPlan, PlanStep, StepStatus } from '@/types/agent';

interface PlanProgressProps {
  plan: ExecutionPlan | null;
  isLoading?: boolean;
  className?: string;
}

interface StepItemProps {
  step: PlanStep;
  isCurrentStep: boolean;
}

const STATUS_CONFIG: Record<StepStatus, { icon: typeof Circle; color: string; label: string }> = {
  pending: { icon: Circle, color: 'text-muted-foreground', label: 'Pending' },
  in_progress: { icon: Loader2, color: 'text-blue-500', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  skipped: { icon: SkipForward, color: 'text-yellow-500', label: 'Skipped' },
};

function StepItem({ step, isCurrentStep }: StepItemProps): React.ReactElement {
  const config = STATUS_CONFIG[step.status];
  const Icon = config.icon;
  
  return (
    <li
      className={cn(
        'flex items-start gap-3 p-2 rounded-md',
        isCurrentStep && 'bg-muted'
      )}
      aria-current={isCurrentStep ? 'step' : undefined}
    >
      <Icon 
        className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.color)}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{step.description}</p>
        {step.result && (
          <p className="text-xs text-muted-foreground mt-1">{step.result}</p>
        )}
      </div>
      <Badge variant="outline" className="text-xs">
        {config.label}
      </Badge>
    </li>
  );
}

export function PlanProgress({ 
  plan, 
  isLoading = false, 
  className 
}: PlanProgressProps): React.ReactElement | null {
  if (!plan && !isLoading) return null;

  const completedSteps = plan?.steps.filter(s => s.status === 'completed').length ?? 0;
  const totalSteps = plan?.steps.length ?? 0;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Execution Plan</span>
          {plan && (
            <Badge variant={plan.status === 'completed' ? 'default' : 'secondary'}>
              {plan.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4" role="status">
            <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading plan" />
          </div>
        ) : plan ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">{plan.goal}</p>
            <Progress value={progressPercent} className="mb-4" aria-label="Plan progress" />
            <ol className="space-y-1" aria-label="Plan steps">
              {plan.steps.map((step, index) => (
                <StepItem
                  key={step.step_number}
                  step={step}
                  isCurrentStep={index === plan.current_step_index}
                />
              ))}
            </ol>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

3. **Memory Management page updates**
   - Show session short-term memory (plan) alongside long-term memory

---

## Testing Plan

### Unit Tests

1. **Plan creation via tool**
   - Verify plan is stored in `agent_session_memory`
   - Verify step structure is correct

2. **Plan updates**
   - Step status transitions work correctly
   - Plan completion triggers correct status

3. **Loop continuation logic**
   - Continues when plan has pending steps
   - Stops when plan is complete/failed/waiting

### Integration Tests

1. **Full autonomous task execution**
   - User: "List all files in my storage"
   - Agent creates plan → executes each step → marks complete → responds GOAL_COMPLETE

2. **User input required scenario**
   - User: "Help me organize my files"
   - Agent creates plan → realizes it needs clarification → calls wait_for_user → stops

3. **Max iterations safety**
   - Agent with inefficient plan hits max_steps limit
   - Graceful termination with partial progress saved

4. **Plan adjustment mid-execution**
   - Agent discovers new information → creates revised plan → continues

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Agent doesn't create plan | Planning prompt strongly instructs; could add validation |
| Infinite loops | MAX_CONSECUTIVE_NON_TOOL_RESPONSES + max_steps |
| Plan too granular (too many steps) | Prompt guidance for 3-7 steps; could add validation |
| Plan too vague (steps not actionable) | Prompt examples; could add LLM validation |
| Runaway API costs | Token budget per session (future enhancement) |
| Agent ignores plan | Plan status injected into every prompt |

---

## Success Metrics

- Agent completes multi-step tasks without user prompts
- Plan creation rate > 95% for new tasks
- Average plan completion rate > 80%
- User satisfaction with autonomous behavior
- No increase in runaway/stuck sessions
- Reduced average messages per task completion

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Database & Tool | 2-3 hours | None |
| Phase 2: Agent Loop | 2-3 hours | Phase 1 |
| Phase 3: Admin Prompt | 1 hour | Phase 1 |
| Phase 4: UI | 2-3 hours | Phase 2 |

**Total**: ~8-10 hours

---

## Files to Create/Modify

### New Files
- `migrations/015_agent_session_memory.sql` - Session memory table
- `netlify/functions/tool-plan.ts` - Plan management tool endpoint
- `src/components/agent-chat/PlanProgress.tsx` - Plan visualization component

### Modified Files
- `netlify/functions/agent-loop-background.ts` - Loop logic + plan checking
- `netlify/functions/agent-chat.ts` - Include plan in prompt building
- `src/pages/agent-chat/AgentChatPage.tsx` - Display plan progress
- `src/types/agent.ts` - Add ExecutionPlan types

### Database Entries
- `agent_session_memory` table (via migration)
- `update_plan` tool in `agent_tools` table
- `agent_planning_system` prompt in `prompts` table
