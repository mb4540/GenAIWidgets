-- Seed script for update_plan builtin tool
-- This tool allows agents to create and manage execution plans for autonomous operation

-- Insert the update_plan tool using the first tenant and admin user
INSERT INTO agent_tools (tenant_id, user_id, name, description, tool_type, input_schema, is_active)
SELECT 
  t.tenant_id,
  u.user_id,
  'update_plan',
  'Create or update your execution plan. Call at the start of every task to create a plan, and after completing each step to mark progress. The plan guides your autonomous execution.',
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
        "description": "The goal you are trying to accomplish (required for create action)"
      },
      "steps": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "step_number": { "type": "integer" },
            "description": { "type": "string" }
          },
          "required": ["step_number", "description"]
        },
        "description": "The steps to accomplish the goal (required for create action, max 10)"
      },
      "step_number": {
        "type": "integer",
        "description": "The step number to update (required for update_step action)"
      },
      "step_status": {
        "type": "string",
        "enum": ["in_progress", "completed", "failed", "skipped"],
        "description": "The new status for the step (required for update_step action)"
      },
      "step_result": {
        "type": "string",
        "description": "Summary of what happened in this step (optional for update_step)"
      },
      "reason": {
        "type": "string",
        "description": "Reason for completion/failure/waiting (required for complete, fail, wait_for_user)"
      }
    },
    "required": ["action"]
  }'::jsonb,
  true
FROM tenants t
CROSS JOIN users u
JOIN admins a ON u.user_id = a.user_id
LIMIT 1
ON CONFLICT (tenant_id, name) 
DO UPDATE SET 
  description = EXCLUDED.description,
  input_schema = EXCLUDED.input_schema,
  updated_at = now();
