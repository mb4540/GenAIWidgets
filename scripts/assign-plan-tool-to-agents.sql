-- Assign the update_plan tool to all existing agents
-- This enables autonomous execution with planning

-- First, ensure the update_plan tool exists and get its ID
WITH plan_tool AS (
  SELECT tool_id 
  FROM agent_tools 
  WHERE name = 'update_plan' 
  LIMIT 1
)
INSERT INTO agent_tool_assignments (agent_id, tool_id)
SELECT a.agent_id, pt.tool_id
FROM agents a
CROSS JOIN plan_tool pt
WHERE NOT EXISTS (
  SELECT 1 
  FROM agent_tool_assignments ata 
  WHERE ata.agent_id = a.agent_id 
  AND ata.tool_id = pt.tool_id
);

-- Show results
SELECT 
  a.name as agent_name,
  t.name as tool_name,
  ata.assigned_at
FROM agent_tool_assignments ata
JOIN agents a ON a.agent_id = ata.agent_id
JOIN agent_tools t ON t.tool_id = ata.tool_id
WHERE t.name = 'update_plan';
