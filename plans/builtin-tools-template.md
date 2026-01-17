# Builtin Tools Implementation Plan

This is a reusable template for adding builtin tools to the Agent Mode system. Builtin tools are Netlify Functions that agents can invoke during chat, implemented as part of the codebase rather than external MCP servers.

---

## Overview

**What are Builtin Tools?**
- Native Netlify Functions that execute tool logic
- Stored in `agent_tools` table with `tool_type: 'builtin'`
- Invoked by the agent loop when an LLM requests the tool
- No external dependencies or MCP protocol overhead

**Benefits:**
- Lower latency (direct function calls)
- Full control over implementation
- Integrated with existing auth/tenant system
- No external hosting required

---

## Template: Adding a New Builtin Tool

### Step 1: Define the Tool Specification

Before coding, document the tool:

```yaml
Tool Name: [tool_name]  # snake_case, used by LLM
Display Name: [Tool Name]  # Human-readable
Description: [Clear description for LLM to understand when to use]
Category: [weather | file | search | utility | etc.]

Parameters:
  - name: [param1]
    type: [string | number | boolean | object]
    required: [true | false]
    description: [What this parameter does]
  
  - name: [param2]
    type: [string]
    required: [false]
    default: [default_value]
    description: [What this parameter does]

Returns:
  - Success: [Description of successful response]
  - Error: [Description of error cases]

External APIs:
  - [API Name]: [URL] - [Purpose]
  - API Key Required: [yes/no]
```

### Step 2: Create the Netlify Function

Create `netlify/functions/tool-[name].ts`:

```typescript
import type { Context } from '@netlify/functions';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface ToolInput {
  // Define input parameters
}

interface ToolOutput {
  // Define output structure
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  // 1. Authenticate request
  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return createErrorResponse(authResult.error, 401);
  }

  // 2. Only allow POST
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

  try {
    // 3. Parse and validate input
    const body = await req.json() as ToolInput;
    
    // 4. Execute tool logic
    const result = await executeToolLogic(body);
    
    // 5. Return result
    return createSuccessResponse({ result });
  } catch (error) {
    console.error('[tool-name] Error:', error);
    return createErrorResponse('Tool execution failed', 500);
  }
}

async function executeToolLogic(input: ToolInput): Promise<ToolOutput> {
  // Implement tool logic here
}
```

### Step 3: Add Redirect in netlify.toml

```toml
[[redirects]]
  from = "/api/tools/[name]"
  to = "/.netlify/functions/tool-[name]"
  status = 200
```

### Step 4: Update Agent Loop to Handle Builtin Tools

In `netlify/functions/agent-loop-background.ts`, add case for builtin tool execution:

```typescript
// In the tool execution section
if (tool.tool_type === 'builtin') {
  const response = await fetch(`${baseUrl}/api/tools/${tool.name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(toolInput),
  });
  const result = await response.json();
  return result;
}
```

### Step 5: Seed the Tool in Database

Create a migration or seed script:

```sql
INSERT INTO agent_tools (
  tenant_id,
  name,
  description,
  tool_type,
  input_schema,
  is_active,
  created_by
) VALUES (
  '[tenant_id or NULL for global]',
  '[tool_name]',
  '[description]',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "param1": { "type": "string", "description": "..." },
      "param2": { "type": "number", "description": "..." }
    },
    "required": ["param1"]
  }',
  true,
  '[admin_user_id]'
);
```

### Step 6: Test the Tool

1. Assign tool to an agent via UI
2. Start a chat session
3. Prompt the agent to use the tool
4. Verify tool execution and response

---

## Implementation: Weather Tool

### Tool Specification

```yaml
Tool Name: get_weather
Display Name: Get Weather
Description: Get the current weather for a given location. Returns temperature, conditions, humidity, and wind information.
Category: weather

Parameters:
  - name: location
    type: string
    required: true
    description: City name or location (e.g., "New York, NY" or "Paris, France")
  
  - name: units
    type: string
    required: false
    default: "imperial"
    description: Temperature units - "imperial" (°F) or "metric" (°C)

Returns:
  - Success: Weather data including temperature, conditions, humidity, wind speed
  - Error: Location not found, API error

External APIs:
  - Open-Meteo Geocoding: https://geocoding-api.open-meteo.com - Location search
  - Open-Meteo Weather: https://api.open-meteo.com - Weather data
  - API Key Required: No (free, no auth)
```

### Implementation Tasks

- [ ] **Phase 1: Database & Types**
  - [ ] Add 'builtin' to tool_type enum if not exists
  - [ ] Update TypeScript types for builtin tools
  - [ ] Create seed script for get_weather tool

- [ ] **Phase 2: Weather Function**
  - [ ] Create `netlify/functions/tool-weather.ts`
  - [ ] Implement location search (Open-Meteo Geocoding API)
  - [ ] Implement weather fetch (Open-Meteo Weather API)
  - [ ] Add error handling and validation
  - [ ] Add redirect in netlify.toml

- [ ] **Phase 3: Agent Loop Integration**
  - [ ] Update agent-loop-background.ts to handle builtin tools
  - [ ] Update agent-chat.ts if needed
  - [ ] Test tool invocation flow

- [ ] **Phase 4: UI Enhancements (Optional)**
  - [ ] Add "System" badge for builtin tools in tool list
  - [ ] Make builtin tools read-only in UI (can't edit/delete)
  - [ ] Add tool type indicator in agent's Tools tab

- [ ] **Phase 5: Testing & Deployment**
  - [ ] Test locally with netlify dev
  - [ ] Test tool assignment to agent
  - [ ] Test chat invocation
  - [ ] Deploy to production
  - [ ] Verify in production

---

## Future Builtin Tools (Ideas)

| Tool Name | Description | APIs |
|-----------|-------------|------|
| `search_web` | Search the web for information | Google/Bing API |
| `get_stock_price` | Get current stock prices | Alpha Vantage |
| `send_email` | Send an email | SendGrid/Resend |
| `create_calendar_event` | Create calendar events | Google Calendar |
| `generate_image` | Generate images from text | DALL-E/Stable Diffusion |
| `run_code` | Execute code snippets | Sandboxed runtime |
| `query_database` | Query tenant's data | Internal DB |

---

## Notes

- Builtin tools should be tenant-agnostic (available to all tenants) or explicitly scoped
- Consider rate limiting for external API calls
- Cache responses where appropriate (weather data can be cached 15-30 min)
- Log tool invocations for debugging and analytics
- Handle API failures gracefully with user-friendly error messages
