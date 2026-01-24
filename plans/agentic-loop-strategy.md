# Agentic Loop Strategy for Netlify Serverless

## Executive Summary

This plan outlines a strategy to transform the current user-driven agent flow into a fully autonomous agentic loop running on Netlify serverless infrastructure. The goal is to enable agents to execute multi-step tasks independently while providing real-time visibility and graceful intervention points.

## Current State Analysis

### What Exists
- **agent-loop-background.ts**: Background function with autonomous loop logic
- **agent-chat.ts**: Synchronous endpoint requiring user input each step
- **Execution Plan System**: `agent_session_memory` table with plan tracking
- **Tool Execution**: Builtin tools (weather, files, plan updates)
- **Frontend Auto-Continue**: `shouldContinue` flag triggers auto-continuation up to 20 iterations

### Current Limitations
1. **Frontend-Driven Loop**: Auto-continuation happens in browser, not server
2. **Connection Dependency**: Browser must stay open for continuation
3. **Timeout Constraints**: Background functions have 15-minute max (Netlify)
4. **No Real-Time Updates**: Frontend polls or waits for full completion
5. **Limited Error Recovery**: No retry logic or checkpoint resumption

---

## Proposed Architecture

### Pattern: Event-Driven Agentic Loop with State Machine

Based on [AWS serverless AI agent patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-serverless/introduction.html), we'll implement a state machine approach where each step is atomic and resumable.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT                                    │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────┐   │
│  │ Start    │───▶│ Poll Status  │───▶│ Display Results     │   │
│  │ Session  │    │ (SSE/WebSocket│   │ (streaming updates) │   │
│  └──────────┘    │  or polling)  │    └─────────────────────┘   │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NETLIFY FUNCTIONS                             │
│                                                                  │
│  ┌──────────────┐      ┌──────────────────────────────────┐    │
│  │ agent-start  │─────▶│ agent-step-background             │    │
│  │ (trigger)    │      │                                   │    │
│  └──────────────┘      │  ┌─────────────────────────────┐ │    │
│                        │  │ 1. Load session state       │ │    │
│  ┌──────────────┐      │  │ 2. Call LLM                 │ │    │
│  │ agent-status │      │  │ 3. Execute tools (if any)   │ │    │
│  │ (polling)    │      │  │ 4. Save state               │ │    │
│  └──────────────┘      │  │ 5. Self-invoke if continue  │ │    │
│                        │  └─────────────────────────────┘ │    │
│                        └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      STATE STORAGE                               │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Neon PostgreSQL  │  │ Netlify Blobs    │                    │
│  │ (session state,  │  │ (large context,  │                    │
│  │  messages, plan) │  │  file artifacts) │                    │
│  └──────────────────┘  └──────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Strategy

### Phase 1: State Machine Foundation

#### 1.1 Define Agent States

```typescript
type AgentState =
  | 'idle'              // Waiting for user to start
  | 'planning'          // Creating execution plan
  | 'executing'         // Running autonomous loop
  | 'waiting_for_tool'  // Long-running tool in progress
  | 'waiting_for_user'  // Needs user input to proceed
  | 'completed'         // Goal achieved
  | 'failed'            // Error state
  | 'cancelled';        // User cancelled
```

#### 1.2 Checkpoint System

Add checkpointing to enable resumption after timeouts or failures:

```sql
-- Add to agent_sessions table
ALTER TABLE agent_sessions ADD COLUMN checkpoint JSONB;
ALTER TABLE agent_sessions ADD COLUMN last_checkpoint_at TIMESTAMPTZ;
ALTER TABLE agent_sessions ADD COLUMN retry_count INTEGER DEFAULT 0;
```

Checkpoint structure:
```typescript
interface SessionCheckpoint {
  conversation_context: LLMMessage[];  // Truncated to last N messages
  pending_tool_calls: ToolCall[];
  current_plan_step: number;
  loop_iteration: number;
  last_llm_response_id: string;
}
```

### Phase 2: Self-Invoking Background Function

#### 2.1 Step-Based Execution

Instead of one long-running loop, break into discrete steps:

```typescript
// agent-step-background.ts
export default async function handler(req: Request): Promise<Response> {
  const { sessionId, stepType } = await req.json();

  // Load checkpoint
  const checkpoint = await loadCheckpoint(sessionId);

  // Execute single step based on type
  switch (stepType) {
    case 'llm_call':
      return await executeLLMStep(sessionId, checkpoint);
    case 'tool_execution':
      return await executeToolStep(sessionId, checkpoint);
    case 'plan_evaluation':
      return await evaluatePlanStep(sessionId, checkpoint);
  }
}

async function executeLLMStep(sessionId: string, checkpoint: Checkpoint) {
  // 1. Call LLM
  const response = await callLLM(...);

  // 2. Save checkpoint
  await saveCheckpoint(sessionId, { ...checkpoint, lastResponse: response });

  // 3. Determine next step and self-invoke
  if (response.tool_calls?.length > 0) {
    await triggerNextStep(sessionId, 'tool_execution');
  } else if (shouldContinue(response)) {
    await triggerNextStep(sessionId, 'llm_call');
  }

  return new Response(JSON.stringify({ success: true }));
}

async function triggerNextStep(sessionId: string, stepType: string) {
  const baseUrl = process.env.URL || 'http://localhost:8888';
  await fetch(`${baseUrl}/.netlify/functions/agent-step-background`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, stepType }),
  });
}
```

#### 2.2 Timeout Handling

Implement graceful timeout handling with automatic resumption:

```typescript
// In netlify.toml
[functions."agent-step-background"]
  timeout = 300  # 5 minutes per step

// In function
const STEP_TIMEOUT_MS = 270000; // 4.5 minutes (leave buffer)

async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T | 'TIMEOUT'> {
  const timeoutPromise = new Promise<'TIMEOUT'>((resolve) =>
    setTimeout(() => resolve('TIMEOUT'), timeoutMs)
  );
  return Promise.race([operation(), timeoutPromise]);
}
```

### Phase 3: Real-Time Status Updates

#### 3.1 Server-Sent Events (SSE) Endpoint

```typescript
// agent-stream.ts
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Poll database for updates
      let lastMessageId = '';
      while (true) {
        const updates = await getSessionUpdates(sessionId, lastMessageId);

        for (const update of updates) {
          const event = `data: ${JSON.stringify(update)}\n\n`;
          controller.enqueue(encoder.encode(event));
          lastMessageId = update.message_id;
        }

        // Check if session ended
        const session = await getSession(sessionId);
        if (['completed', 'failed', 'cancelled'].includes(session.status)) {
          controller.close();
          break;
        }

        await sleep(1000);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

#### 3.2 Frontend Integration

```typescript
// useAgentStream.ts
export function useAgentStream(sessionId: string) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [status, setStatus] = useState<AgentState>('idle');

  useEffect(() => {
    const eventSource = new EventSource(`/api/agent-stream?sessionId=${sessionId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'message') {
        setMessages(prev => [...prev, data.message]);
      } else if (data.type === 'status') {
        setStatus(data.status);
      }
    };

    return () => eventSource.close();
  }, [sessionId]);

  return { messages, status };
}
```

### Phase 4: Robust Continuation Logic

#### 4.1 Enhanced Plan Evaluation

```typescript
interface ContinuationDecision {
  shouldContinue: boolean;
  reason: 'goal_complete' | 'user_input_needed' | 'max_steps' | 'error' | 'pending_steps';
  nextAction?: 'llm_call' | 'tool_execution' | 'wait';
}

function evaluateContinuation(
  session: Session,
  plan: ExecutionPlan | null,
  lastResponse: LLMResponse,
  metrics: LoopMetrics
): ContinuationDecision {
  // Priority 1: Goal completion
  if (lastResponse.content?.includes('GOAL_COMPLETE')) {
    return { shouldContinue: false, reason: 'goal_complete' };
  }

  // Priority 2: Max steps reached
  if (metrics.totalSteps >= session.max_steps) {
    return { shouldContinue: false, reason: 'max_steps' };
  }

  // Priority 3: Tool calls pending
  if (lastResponse.tool_calls?.length > 0) {
    return { shouldContinue: true, reason: 'pending_steps', nextAction: 'tool_execution' };
  }

  // Priority 4: Plan has pending steps
  if (plan && shouldContinueBasedOnPlan(plan)) {
    return { shouldContinue: true, reason: 'pending_steps', nextAction: 'llm_call' };
  }

  // Priority 5: Explicit user input request
  if (detectUserInputRequest(lastResponse.content)) {
    return { shouldContinue: false, reason: 'user_input_needed' };
  }

  // Default: Continue if no explicit stop signal
  return { shouldContinue: true, reason: 'pending_steps', nextAction: 'llm_call' };
}
```

#### 4.2 Stuck Detection

Prevent infinite loops with stuck detection:

```typescript
interface LoopMetrics {
  totalSteps: number;
  consecutiveNoProgress: number;
  lastPlanStepIndex: number;
  repeatedResponses: Map<string, number>;  // Hash -> count
}

function detectStuck(metrics: LoopMetrics, response: LLMResponse): boolean {
  // Check for repeated identical responses
  const responseHash = hashResponse(response);
  const repeatCount = metrics.repeatedResponses.get(responseHash) || 0;
  if (repeatCount >= 3) return true;

  // Check for no plan progress
  if (metrics.consecutiveNoProgress >= 5) return true;

  return false;
}
```

### Phase 5: Human-in-the-Loop Intervention Points

#### 5.1 Intervention Types

```typescript
type InterventionType =
  | 'approval_required'    // High-stakes action needs approval
  | 'clarification_needed' // Ambiguous situation
  | 'error_recovery'       // Error occurred, need guidance
  | 'checkpoint_review'    // Periodic human review
  | 'budget_exceeded';     // Token/cost limit reached

interface InterventionRequest {
  type: InterventionType;
  context: string;
  options?: string[];
  timeout_minutes?: number;
  default_action?: string;
}
```

#### 5.2 Approval Workflow

```typescript
// Define actions requiring approval
const HIGH_STAKES_TOOLS = ['delete_file', 'send_email', 'execute_code'];

async function executeToolWithApproval(
  toolCall: ToolCall,
  session: Session
): Promise<ToolResult> {
  if (HIGH_STAKES_TOOLS.includes(toolCall.function.name)) {
    // Create approval request
    await createInterventionRequest(session.session_id, {
      type: 'approval_required',
      context: `Agent wants to execute: ${toolCall.function.name}`,
      options: ['Approve', 'Reject', 'Modify'],
      timeout_minutes: 30,
      default_action: 'Reject',
    });

    // Pause execution
    await updateSessionState(session.session_id, 'waiting_for_user');

    // Return placeholder - will resume when approved
    return { pending: true, intervention_id: interventionId };
  }

  return await executeTool(toolCall);
}
```

---

## Database Schema Changes

### New Tables

```sql
-- Intervention requests for human-in-the-loop
CREATE TABLE agent_interventions (
  intervention_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
  intervention_type TEXT NOT NULL,
  context TEXT NOT NULL,
  options JSONB,
  default_action TEXT,
  timeout_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  resolved_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step execution log for debugging and analytics
CREATE TABLE agent_step_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL,  -- 'llm_call', 'tool_execution', 'plan_evaluation'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  tokens_used INTEGER,
  error TEXT,
  checkpoint JSONB
);

CREATE INDEX idx_interventions_session ON agent_interventions(session_id);
CREATE INDEX idx_interventions_pending ON agent_interventions(session_id)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_step_log_session ON agent_step_log(session_id, step_number);
```

### Modify Existing Tables

```sql
-- Add checkpoint support to sessions
ALTER TABLE agent_sessions
  ADD COLUMN checkpoint JSONB,
  ADD COLUMN last_checkpoint_at TIMESTAMPTZ,
  ADD COLUMN retry_count INTEGER DEFAULT 0,
  ADD COLUMN total_tokens_used INTEGER DEFAULT 0,
  ADD COLUMN state TEXT DEFAULT 'idle';
```

---

## Implementation Order

### Sprint 1: Foundation (1-2 days)
1. Add database schema changes
2. Create `agent-step-background.ts` with self-invocation
3. Implement checkpoint save/load
4. Add timeout handling

### Sprint 2: Real-Time Updates (1-2 days)
1. Create `agent-stream.ts` SSE endpoint
2. Update frontend with `useAgentStream` hook
3. Add status indicators and live message updates

### Sprint 3: Robust Loop Logic (1-2 days)
1. Implement enhanced continuation evaluation
2. Add stuck detection
3. Implement retry logic with exponential backoff

### Sprint 4: Human Intervention (1-2 days)
1. Create intervention system
2. Add approval workflow for high-stakes actions
3. Build intervention UI in frontend

### Sprint 5: Polish & Testing (1-2 days)
1. End-to-end testing
2. Error handling edge cases
3. Performance optimization
4. Documentation

---

## Configuration

### netlify.toml Updates

```toml
[functions."agent-step-background"]
  timeout = 300  # 5 minutes per step

[functions."agent-stream"]
  timeout = 900  # 15 minutes for SSE connection

# New routes
[[redirects]]
  from = "/api/agent-start"
  to = "/.netlify/functions/agent-start"
  status = 200

[[redirects]]
  from = "/api/agent-step"
  to = "/.netlify/functions/agent-step-background"
  status = 200

[[redirects]]
  from = "/api/agent-stream"
  to = "/.netlify/functions/agent-stream"
  status = 200

[[redirects]]
  from = "/api/agent-interventions"
  to = "/.netlify/functions/agent-interventions"
  status = 200
```

---

## Success Metrics

1. **Autonomy**: Agent completes multi-step tasks without user intervention
2. **Reliability**: <1% failure rate due to timeouts or lost state
3. **Visibility**: Real-time updates visible within 2 seconds
4. **Recovery**: Automatic resumption after transient failures
5. **Control**: Users can pause/resume/cancel at any point

---

## References

- [Building serverless architectures for agentic AI on AWS](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-serverless/introduction.html)
- [Event-driven architecture for agentic AI](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-serverless/event-driven-architecture.html)
- [Agentic AI patterns and workflows on AWS](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-patterns/introduction.html)
- [FAME: FaaS for MCP-enabled Agentic Workflows](https://arxiv.org/html/2601.14735)
