# Agent Loop Autonomous Execution - Phased Implementation Plan

**Source Document:** `agent-loop-autonomous-execution.md`  
**Created:** 2026-01-24  
**Status:** Not Started

---

## Phase Tracking

| Phase | Name | Status | Est. Hours | Tested |
|-------|------|--------|------------|--------|
| 1 | Database Schema | ⬜ Not Started | 1-2 | ⬜ |
| 2 | Plan Tool Backend | ⬜ Not Started | 2-3 | ⬜ |
| 3 | Agent Loop Integration | ⬜ Not Started | 2-3 | ⬜ |
| 4 | Admin Prompt Setup | ⬜ Not Started | 1 | ⬜ |
| 5 | Frontend Plan Display | ⬜ Not Started | 2-3 | ⬜ |
| 6 | End-to-End Testing | ⬜ Not Started | 1-2 | ⬜ |

**Total Estimated:** 9-14 hours

---

## Phase 1: Database Schema

**Goal:** Create the `agent_session_memory` table for storing execution plans.

### Tasks

- [ ] 1.1 Consult `/db_ref.md` for existing schema context
- [ ] 1.2 Create migration file `migrations/015_agent_session_memory.sql`
- [ ] 1.3 Run migration on development database
- [ ] 1.4 Update `/db_ref.md` with new table documentation
- [ ] 1.5 Add TypeScript types to `src/types/agent.ts`

### Deliverables

**File:** `migrations/015_agent_session_memory.sql`
```sql
-- Migration: 015_agent_session_memory.sql
-- Description: Short-term working memory for agent sessions
-- Rollback: DROP TABLE IF EXISTS agent_session_memory;

CREATE TABLE IF NOT EXISTS agent_session_memory (
    memory_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID NOT NULL,
    memory_key    TEXT NOT NULL,
    memory_value  JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_session_memory_session
        FOREIGN KEY (session_id) 
        REFERENCES agent_sessions(session_id) 
        ON DELETE CASCADE,

    CONSTRAINT agent_session_memory_unique_key
        UNIQUE (session_id, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_session_memory_session_id 
    ON agent_session_memory(session_id);

CREATE INDEX IF NOT EXISTS idx_session_memory_session_key 
    ON agent_session_memory(session_id, memory_key);

CREATE TRIGGER update_agent_session_memory_updated_at
    BEFORE UPDATE ON agent_session_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agent_session_memory IS 'Short-term working memory for agent sessions';
```

**File:** `src/types/agent.ts` (additions)
```typescript
// Plan status types
export type PlanStatus = 'planning' | 'executing' | 'completed' | 'failed' | 'waiting_for_user';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface PlanStep {
  readonly step_number: number;
  readonly description: string;
  status: StepStatus;
  result?: string;
  completed_at?: string;
}

export interface ExecutionPlan {
  readonly created_at: string;
  updated_at: string;
  readonly goal: string;
  steps: readonly PlanStep[];
  current_step_index: number;
  status: PlanStatus;
}
```

### Testing Phase 1

```bash
# 1. Run migration
cd /Users/michaelberry/Documents/CascadeProjects/GenAIWidgets
# Apply migration via Neon console or psql

# 2. Verify table exists
# In Neon console:
SELECT * FROM agent_session_memory LIMIT 1;

# 3. Test insert/update
INSERT INTO agent_session_memory (session_id, memory_key, memory_value)
VALUES ('00000000-0000-0000-0000-000000000000', 'test_key', '{"test": true}'::jsonb);
-- Should fail with FK constraint (expected)

# 4. Verify TypeScript compiles
npm run build
```

### Phase 1 Completion Criteria

- [ ] Migration runs without errors
- [ ] Table exists with correct schema
- [ ] Indexes created
- [ ] FK constraint enforced
- [ ] TypeScript types compile
- [ ] `/db_ref.md` updated

---

## Phase 2: Plan Tool Backend

**Goal:** Implement the `update_plan` builtin tool endpoint.

### Tasks

- [ ] 2.1 Create `netlify/functions/tool-plan.ts`
- [ ] 2.2 Implement plan CRUD operations (create, update_step, complete, fail, wait_for_user)
- [ ] 2.3 Add input validation
- [ ] 2.4 Add authorization checks
- [ ] 2.5 Add `update_plan` to `BUILTIN_TOOL_ENDPOINTS` in `agent-loop-background.ts`
- [ ] 2.6 Insert `update_plan` tool definition into `agent_tools` table

### Deliverables

**File:** `netlify/functions/tool-plan.ts`

```typescript
import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

import type { ExecutionPlan, PlanStep, PlanStatus, StepStatus } from '../../src/types/agent';

interface PlanInput {
  action: 'create' | 'update_step' | 'complete' | 'fail' | 'wait_for_user';
  goal?: string;
  steps?: Array<{ step_number: number; description: string }>;
  step_number?: number;
  step_status?: StepStatus;
  step_result?: string;
  reason?: string;
}

const VALID_ACTIONS = ['create', 'update_step', 'complete', 'fail', 'wait_for_user'] as const;
const VALID_STEP_STATUSES: StepStatus[] = ['in_progress', 'completed', 'failed', 'skipped'];

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return createErrorResponse(authResult.error, authResult.status);
  }

  const { tenantId, isAdmin } = authResult.context;

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[tool-plan] Missing DATABASE_URL');
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  try {
    const body = await req.json() as PlanInput & { session_id?: string };
    const { action, session_id: sessionId } = body;

    // Validate required fields
    if (!sessionId) {
      return createErrorResponse('session_id is required', 400);
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return createErrorResponse(`Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`, 400);
    }

    // Verify session ownership
    const sessionResult = await sql`
      SELECT session_id, tenant_id FROM agent_sessions WHERE session_id = ${sessionId}
    ` as { session_id: string; tenant_id: string }[];

    const session = sessionResult[0];
    if (!session) {
      return createErrorResponse('Session not found', 404);
    }

    if (session.tenant_id !== tenantId && !isAdmin) {
      console.warn('[tool-plan] Unauthorized access attempt', { attemptedSessionId: sessionId });
      return createErrorResponse('Forbidden', 403);
    }

    // Handle actions
    if (action === 'create') {
      return handleCreatePlan(sql, sessionId, body);
    } else if (action === 'update_step') {
      return handleUpdateStep(sql, sessionId, body);
    } else if (action === 'complete' || action === 'fail' || action === 'wait_for_user') {
      return handleStatusChange(sql, sessionId, action, body.reason);
    }

    return createErrorResponse('Unknown action', 400);
  } catch (error) {
    console.error('[tool-plan] Error:', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse('Internal server error', 500);
  }
}

async function handleCreatePlan(
  sql: ReturnType<typeof neon>,
  sessionId: string,
  body: PlanInput
): Promise<Response> {
  if (!body.goal || typeof body.goal !== 'string' || body.goal.trim().length === 0) {
    return createErrorResponse('goal is required for create action', 400);
  }

  if (!body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
    return createErrorResponse('steps array is required for create action', 400);
  }

  if (body.steps.length > 10) {
    return createErrorResponse('Maximum 10 steps allowed', 400);
  }

  const now = new Date().toISOString();
  const plan: ExecutionPlan = {
    created_at: now,
    updated_at: now,
    goal: body.goal.trim(),
    steps: body.steps.map((s, i) => ({
      step_number: s.step_number ?? i + 1,
      description: s.description,
      status: 'pending' as StepStatus,
    })),
    current_step_index: 0,
    status: 'executing',
  };

  await sql`
    INSERT INTO agent_session_memory (session_id, memory_key, memory_value)
    VALUES (${sessionId}, 'execution_plan', ${JSON.stringify(plan)}::jsonb)
    ON CONFLICT (session_id, memory_key) 
    DO UPDATE SET memory_value = ${JSON.stringify(plan)}::jsonb, updated_at = now()
  `;

  console.log('[tool-plan] Plan created', { sessionId, stepCount: plan.steps.length });

  return createSuccessResponse({ 
    result: { 
      action: 'created', 
      plan_status: plan.status,
      step_count: plan.steps.length 
    } 
  }, 201);
}

async function handleUpdateStep(
  sql: ReturnType<typeof neon>,
  sessionId: string,
  body: PlanInput
): Promise<Response> {
  if (body.step_number === undefined || typeof body.step_number !== 'number') {
    return createErrorResponse('step_number is required for update_step action', 400);
  }

  if (!body.step_status || !VALID_STEP_STATUSES.includes(body.step_status)) {
    return createErrorResponse(`step_status must be one of: ${VALID_STEP_STATUSES.join(', ')}`, 400);
  }

  // Get current plan
  const result = await sql`
    SELECT memory_value FROM agent_session_memory
    WHERE session_id = ${sessionId} AND memory_key = 'execution_plan'
  ` as { memory_value: ExecutionPlan }[];

  const planRow = result[0];
  if (!planRow) {
    return createErrorResponse('No plan found for this session', 404);
  }

  const plan = planRow.memory_value;
  const stepIndex = plan.steps.findIndex(s => s.step_number === body.step_number);
  
  if (stepIndex === -1) {
    return createErrorResponse(`Step ${body.step_number} not found in plan`, 404);
  }

  // Update step (create mutable copy)
  const updatedSteps = plan.steps.map((step, i) => {
    if (i === stepIndex) {
      return {
        ...step,
        status: body.step_status!,
        result: body.step_result ?? step.result,
        completed_at: body.step_status === 'completed' ? new Date().toISOString() : step.completed_at,
      };
    }
    return step;
  });

  // Update current_step_index if step completed
  let newCurrentIndex = plan.current_step_index;
  if (body.step_status === 'completed' && stepIndex === plan.current_step_index) {
    newCurrentIndex = Math.min(stepIndex + 1, plan.steps.length - 1);
  }

  const updatedPlan: ExecutionPlan = {
    ...plan,
    steps: updatedSteps,
    current_step_index: newCurrentIndex,
    updated_at: new Date().toISOString(),
  };

  await sql`
    UPDATE agent_session_memory 
    SET memory_value = ${JSON.stringify(updatedPlan)}::jsonb, updated_at = now()
    WHERE session_id = ${sessionId} AND memory_key = 'execution_plan'
  `;

  return createSuccessResponse({ 
    result: { 
      action: 'step_updated', 
      step_number: body.step_number,
      step_status: body.step_status 
    } 
  });
}

async function handleStatusChange(
  sql: ReturnType<typeof neon>,
  sessionId: string,
  newStatus: 'completed' | 'failed' | 'waiting_for_user',
  reason?: string
): Promise<Response> {
  const result = await sql`
    SELECT memory_value FROM agent_session_memory
    WHERE session_id = ${sessionId} AND memory_key = 'execution_plan'
  ` as { memory_value: ExecutionPlan }[];

  const planRow = result[0];
  if (!planRow) {
    return createErrorResponse('No plan found for this session', 404);
  }

  const plan = planRow.memory_value;
  const updatedPlan: ExecutionPlan = {
    ...plan,
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  await sql`
    UPDATE agent_session_memory 
    SET memory_value = ${JSON.stringify(updatedPlan)}::jsonb, updated_at = now()
    WHERE session_id = ${sessionId} AND memory_key = 'execution_plan'
  `;

  console.log('[tool-plan] Plan status changed', { sessionId, newStatus });

  return createSuccessResponse({ 
    result: { 
      action: 'status_changed', 
      plan_status: newStatus,
      reason 
    } 
  });
}
```

**SQL:** Insert tool definition
```sql
INSERT INTO agent_tools (tenant_id, user_id, name, description, tool_type, input_schema, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- System tenant or NULL
  '00000000-0000-0000-0000-000000000000',  -- System user
  'update_plan',
  'Create or update your execution plan. Call at the start of every task to create a plan, and after completing each step to mark progress.',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["create", "update_step", "complete", "fail", "wait_for_user"],
        "description": "The action to perform on the plan"
      },
      "goal": {
        "type": "string",
        "description": "The goal (required for create action)"
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
        "description": "The steps (required for create action)"
      },
      "step_number": {
        "type": "integer",
        "description": "Step number to update (required for update_step)"
      },
      "step_status": {
        "type": "string",
        "enum": ["in_progress", "completed", "failed", "skipped"],
        "description": "New status (required for update_step)"
      },
      "step_result": {
        "type": "string",
        "description": "Result summary (optional for update_step)"
      },
      "reason": {
        "type": "string",
        "description": "Reason (required for complete/fail/wait_for_user)"
      }
    },
    "required": ["action"]
  }'::jsonb,
  true
);
```

### Testing Phase 2

```bash
# 1. Start dev server
netlify dev

# 2. Test create plan (replace with valid session_id and token)
curl -X POST http://localhost:8888/api/tools/plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "session_id": "VALID_SESSION_ID",
    "action": "create",
    "goal": "Test the plan tool",
    "steps": [
      {"step_number": 1, "description": "First step"},
      {"step_number": 2, "description": "Second step"}
    ]
  }'

# Expected: 201 with { success: true, result: { action: "created", ... } }

# 3. Test update step
curl -X POST http://localhost:8888/api/tools/plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "session_id": "VALID_SESSION_ID",
    "action": "update_step",
    "step_number": 1,
    "step_status": "completed",
    "step_result": "Step 1 done"
  }'

# 4. Test validation errors
curl -X POST http://localhost:8888/api/tools/plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"action": "invalid"}'

# Expected: 400 with validation error

# 5. Verify in database
# SELECT * FROM agent_session_memory WHERE memory_key = 'execution_plan';
```

### Phase 2 Completion Criteria

- [ ] `tool-plan.ts` compiles without errors
- [ ] Create plan returns 201
- [ ] Update step returns 200
- [ ] Status change returns 200
- [ ] Validation errors return 400
- [ ] Unauthorized access returns 403
- [ ] Tool definition inserted in database

---

## Phase 3: Agent Loop Integration

**Goal:** Modify the agent loop to check plan status and continue autonomously.

### Tasks

- [ ] 3.1 Add `update_plan` to `BUILTIN_TOOL_ENDPOINTS`
- [ ] 3.2 Add `getSessionPlan()` helper function
- [ ] 3.3 Add `shouldContinueBasedOnPlan()` helper function
- [ ] 3.4 Add token budget tracking
- [ ] 3.5 Modify loop continuation logic
- [ ] 3.6 Update `buildSystemPrompt()` to include plan status

### Deliverables

**File:** `netlify/functions/agent-loop-background.ts` (modifications)

```typescript
// Add to BUILTIN_TOOL_ENDPOINTS
const BUILTIN_TOOL_ENDPOINTS: Record<string, string> = {
  get_weather: '/api/tools/weather',
  list_files: '/api/tools/files',
  read_file: '/api/tools/files',
  create_file: '/api/tools/files',
  delete_file: '/api/tools/files',
  update_plan: '/api/tools/plan',  // NEW
};

// Add constants
const MAX_CONSECUTIVE_NON_TOOL_RESPONSES = 3;
const MAX_TOKENS_PER_SESSION = 50000;

// Add helper functions
async function getSessionPlan(
  sql: ReturnType<typeof neon>,
  sessionId: string
): Promise<ExecutionPlan | null> {
  const result = await sql`
    SELECT memory_value FROM agent_session_memory
    WHERE session_id = ${sessionId} AND memory_key = 'execution_plan'
  ` as { memory_value: unknown }[];
  
  const row = result[0];
  if (!row?.memory_value) return null;
  
  const plan = row.memory_value as ExecutionPlan;
  if (!plan.goal || !Array.isArray(plan.steps)) {
    return null;
  }
  
  return plan;
}

function shouldContinueBasedOnPlan(plan: ExecutionPlan | null): boolean {
  if (!plan) return false;
  if (plan.status === 'waiting_for_user') return false;
  if (plan.status === 'completed') return false;
  if (plan.status === 'failed') return false;
  
  return plan.steps.some(
    step => step.status === 'pending' || step.status === 'in_progress'
  );
}

// Modify the else block in the main loop (around line 438)
// Replace:
//   break;
// With:
const plan = await getSessionPlan(sql, sessionId);
const shouldContinue = shouldContinueBasedOnPlan(plan);

if (shouldContinue && consecutiveNonToolResponses < MAX_CONSECUTIVE_NON_TOOL_RESPONSES) {
  consecutiveNonToolResponses++;
  await updateSessionStatus(sql, sessionId, 'active', currentStep);
  // Continue - don't break
} else {
  consecutiveNonToolResponses = 0;
  await updateSessionStatus(sql, sessionId, 'active', currentStep);
  break;
}
```

### Testing Phase 3

```bash
# 1. Start dev server
netlify dev

# 2. Create a test agent session via UI or API

# 3. Send a message that should trigger planning
# "List all files in my storage and summarize them"

# 4. Observe agent behavior:
# - Should create a plan first
# - Should execute steps without waiting for user
# - Should mark steps as complete
# - Should stop when plan is complete or waiting_for_user

# 5. Check session messages in database
# SELECT * FROM agent_session_messages WHERE session_id = 'xxx' ORDER BY step_number;

# 6. Check plan in session memory
# SELECT memory_value FROM agent_session_memory WHERE session_id = 'xxx';
```

### Phase 3 Completion Criteria

- [ ] Agent creates plan on new task
- [ ] Agent continues without user input when plan has pending steps
- [ ] Agent stops when plan status is `waiting_for_user`
- [ ] Agent stops when plan status is `completed`
- [ ] Agent stops after MAX_CONSECUTIVE_NON_TOOL_RESPONSES
- [ ] Plan status visible in session memory

---

## Phase 4: Admin Prompt Setup

**Goal:** Add the Agent Planning System Prompt to the prompts table.

### Tasks

- [ ] 4.1 Create migration or seed script for prompt
- [ ] 4.2 Verify prompt appears in Admin Dashboard Prompts tab
- [ ] 4.3 Update `buildSystemPrompt()` to fetch and include planning prompt

### Deliverables

**SQL:** Insert planning prompt
```sql
INSERT INTO prompts (
  function_name, display_name, description, model_provider, model_name,
  system_prompt, user_prompt_template, temperature, max_tokens, is_active
) VALUES (
  'agent_planning_system',
  'Agent Planning System Prompt',
  'System prompt that instructs agents to create and follow execution plans',
  'anthropic',
  'claude-3-sonnet-20240229',
  '## Execution Model

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
- If you realize your plan needs adjustment, you can create a new plan',
  '{user_message}',
  0.7,
  4096,
  true
);
```

### Testing Phase 4

```bash
# 1. Run the SQL insert

# 2. Start dev server
netlify dev

# 3. Navigate to Admin Dashboard > Prompts tab
# Verify "Agent Planning System Prompt" appears

# 4. Edit the prompt and save
# Verify changes persist

# 5. Test agent uses the prompt
# Send a message and verify agent creates a plan
```

### Phase 4 Completion Criteria

- [ ] Prompt exists in database
- [ ] Prompt visible in Admin Dashboard
- [ ] Prompt editable via UI
- [ ] Agent uses planning instructions

---

## Phase 5: Frontend Plan Display

**Goal:** Show the execution plan in the Agent Chat UI.

### Tasks

- [ ] 5.1 Create `src/components/agent-chat/PlanProgress.tsx`
- [ ] 5.2 Add API endpoint to fetch session plan
- [ ] 5.3 Integrate PlanProgress into AgentChatPage
- [ ] 5.4 Add real-time updates (polling or WebSocket)

### Deliverables

**File:** `src/components/agent-chat/PlanProgress.tsx`
(Full implementation in source plan document)

**File:** `src/pages/agent-chat/AgentChatPage.tsx` (modifications)
```typescript
// Add import
import { PlanProgress } from '@/components/agent-chat/PlanProgress';

// Add state
const [currentPlan, setCurrentPlan] = useState<ExecutionPlan | null>(null);

// Add fetch function
const fetchPlan = useCallback(async () => {
  if (!sessionId) return;
  try {
    const response = await fetch(`/api/session-memory?sessionId=${sessionId}&key=execution_plan`, {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success && data.memory) {
      setCurrentPlan(data.memory.memory_value);
    }
  } catch (error) {
    console.error('Failed to fetch plan:', error);
  }
}, [sessionId, getAuthHeaders]);

// Add to render
<PlanProgress plan={currentPlan} className="mb-4" />
```

### Testing Phase 5

```bash
# 1. Start dev server
netlify dev

# 2. Open Agent Chat in browser

# 3. Start a conversation that triggers planning

# 4. Verify:
# - Plan card appears
# - Steps show with correct status icons
# - Progress bar updates
# - Current step highlighted
# - Plan status badge correct

# 5. Test loading state
# - Refresh page mid-task
# - Plan should reload correctly

# 6. Test accessibility
# - Tab through plan steps
# - Screen reader announces status
```

### Phase 5 Completion Criteria

- [ ] PlanProgress component renders
- [ ] Plan fetched from API
- [ ] Steps display with status icons
- [ ] Progress bar shows completion %
- [ ] Current step highlighted
- [ ] Accessible (keyboard, screen reader)

---

## Phase 6: End-to-End Testing

**Goal:** Verify complete autonomous execution flow.

### Tasks

- [ ] 6.1 Test simple task (list files)
- [ ] 6.2 Test multi-step task (list and summarize)
- [ ] 6.3 Test user input required scenario
- [ ] 6.4 Test max iterations safety
- [ ] 6.5 Test session cancellation
- [ ] 6.6 Test error recovery

### Test Scenarios

**Scenario 1: Simple File Listing**
```
User: "List all files in my storage"
Expected:
1. Agent creates plan with 2-3 steps
2. Agent calls list_files for root
3. Agent explores subdirectories
4. Agent marks plan complete
5. Agent responds with GOAL_COMPLETE
```

**Scenario 2: Multi-Step Task**
```
User: "List all files and tell me how many there are in each folder"
Expected:
1. Agent creates plan with 4-5 steps
2. Agent executes each step autonomously
3. Agent updates plan after each step
4. Agent provides summary at end
```

**Scenario 3: User Input Required**
```
User: "Help me organize my files"
Expected:
1. Agent creates plan
2. Agent realizes it needs clarification
3. Agent calls update_plan with wait_for_user
4. Agent stops and asks user for preferences
```

**Scenario 4: Max Iterations**
```
Configure agent with max_steps = 5
User: "Do a very complex task"
Expected:
1. Agent creates plan
2. Agent executes up to 5 iterations
3. Agent stops gracefully
4. Session marked as completed (goal_met = false)
```

### Phase 6 Completion Criteria

- [ ] All test scenarios pass
- [ ] No infinite loops observed
- [ ] Error handling works correctly
- [ ] UI updates in real-time
- [ ] Performance acceptable

---

## Rollback Plan

If issues are discovered after deployment:

### Phase 1 Rollback
```sql
DROP TABLE IF EXISTS agent_session_memory;
```

### Phase 2 Rollback
- Delete `netlify/functions/tool-plan.ts`
- Remove `update_plan` from `BUILTIN_TOOL_ENDPOINTS`
- Delete tool from `agent_tools` table

### Phase 3 Rollback
- Revert changes to `agent-loop-background.ts`
- Remove helper functions

### Phase 4 Rollback
```sql
DELETE FROM prompts WHERE function_name = 'agent_planning_system';
```

### Phase 5 Rollback
- Delete `PlanProgress.tsx`
- Revert `AgentChatPage.tsx` changes

---

## Notes

- Each phase should be completed and tested before moving to the next
- Commit after each phase with descriptive message
- Update this document with actual completion status
- Document any deviations from the plan
