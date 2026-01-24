import type { Context } from '@netlify/functions';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

import type { ExecutionPlan, PlanStep, PlanStatus, StepStatus } from '../../src/types/agent';

// Type alias for the sql function
type SqlClient = NeonQueryFunction<false, false>;

interface PlanInput {
  action: 'create' | 'update_step' | 'complete' | 'fail' | 'wait_for_user';
  session_id?: string;
  goal?: string;
  steps?: Array<{ step_number: number; description: string }>;
  step_number?: number;
  step_status?: StepStatus;
  step_result?: string;
  reason?: string;
}

interface SessionRow {
  session_id: string;
  tenant_id: string;
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
    const body = await req.json() as PlanInput;
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
    ` as SessionRow[];

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
    } else if (action === 'complete') {
      return handleStatusChange(sql, sessionId, 'completed', body.reason);
    } else if (action === 'fail') {
      return handleStatusChange(sql, sessionId, 'failed', body.reason);
    } else if (action === 'wait_for_user') {
      return handleStatusChange(sql, sessionId, 'waiting_for_user', body.reason);
    }

    return createErrorResponse('Unknown action', 400);
  } catch (error) {
    console.error('[tool-plan] Error:', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse('Internal server error', 500);
  }
}

async function handleCreatePlan(
  sql: SqlClient,
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

  // Validate each step has required fields
  for (const step of body.steps) {
    if (typeof step.step_number !== 'number' || !step.description) {
      return createErrorResponse('Each step must have step_number and description', 400);
    }
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
    status: 'executing' as PlanStatus,
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
  sql: SqlClient,
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
  const updatedSteps: PlanStep[] = plan.steps.map((step, i) => {
    if (i === stepIndex) {
      return {
        ...step,
        status: body.step_status!,
        result: body.step_result ?? step.result,
        completed_at: body.step_status === 'completed' ? new Date().toISOString() : step.completed_at,
      };
    }
    return { ...step };
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
  sql: SqlClient,
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
