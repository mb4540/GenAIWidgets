# Agent Mode Chat - Build Plan

## Overview

Build a new "Agent Mode Chat" widget accessible from the left navigation panel. This feature implements a true Gen-AI agent system with:
- **Goal-driven execution** - LLM decides what to do next
- **Tool use** - MCP servers and Python scripts
- **Session memory** - Context within a conversation
- **Long-term memory** - Persistent knowledge across sessions
- **Agent management** - Create, configure, and review agents

Based on the agent definition from `AgentMode.md`:
> A Gen-AI agent is an LLM that can: decide what to do next, use tools to do it, observe the result, and repeat until a goal is satisfied.

---

## Core Agent Components (from AgentMode.md)

| Component           | Implementation                                              |
|---------------------|-------------------------------------------------------------|
| **Goal awareness**  | Stored per agent, passed to LLM on each step                |
| **State / memory**  | Session memory (conversation) + Long-term memory (facts)    |
| **Decision loop**   | Backend control loop, LLM chooses actions                   |
| **Tool use**        | MCP servers + Python scripts                                |
| **Feedback intake** | Tool results fed back into context                          |

---

## Database Design Standards

All database work must follow the patterns defined in `database-design.md`.

### Mandatory Requirements

- **ALWAYS consult `/db_ref.md`** before any database work
- **Update `/db_ref.md`** after every migration
- Use `UUID` with `DEFAULT gen_random_uuid()` for primary keys
- Use `TIMESTAMPTZ` for all timestamps (timezone-aware)
- All foreign keys MUST have explicit `ON DELETE` behavior
- Create indexes on all foreign key columns (not automatic in PostgreSQL)

### Neon Serverless Driver (Required)

All database access must use the `@neondatabase/serverless` package:

```typescript
import { neon } from '@neondatabase/serverless';

// Create new connection per function invocation
const sql = neon(process.env.DATABASE_URL!);

// ALWAYS use parameterized queries (template literals)
const agents = await sql`
  SELECT * FROM agents 
  WHERE tenant_id = ${tenantId} AND is_active = true
`;

// NEVER use string concatenation
// WRONG: await sql`SELECT * FROM agents WHERE id = '${agentId}'`
```

### Neon Connection Rules

- Use the serverless driver, not `pg` directly
- Create new connection per function invocation
- Do NOT cache connections across invocations
- Use pooler URL for Netlify Functions (`?pgbouncer=true`)
- Always use SSL (`sslmode=require`)

### Migration File Naming

```
migrations/
├── 009_agents_table.sql
├── 010_agent_sessions_tables.sql
├── 011_agent_memory_table.sql
├── 012_agent_tools_tables.sql
└── 013_mcp_python_tables.sql
```

### Migration Checklist

- [ ] Consulted `/db_ref.md` before writing migration
- [ ] Migration file created and tested locally
- [ ] Rollback instructions documented in comments
- [ ] `/db_ref.md` updated with new tables/columns
- [ ] TypeScript types created/updated
- [ ] Indexes created for foreign keys
- [ ] Foreign keys defined with ON DELETE behavior
- [ ] Constraints added for data integrity

---

## Database Schema

### New Tables Required

#### 1. `agents` - Agent Definitions

| Column         | Type          | Nullable | Default           | Description                                         |
|----------------|---------------|----------|-------------------|-----------------------------------------------------|
| agent_id       | UUID          | NO       | gen_random_uuid() | Primary key                                         |
| tenant_id      | UUID          | NO       | -                 | Reference to tenant                                 |
| user_id        | UUID          | NO       | -                 | Creator of agent                                    |
| name           | TEXT          | NO       | -                 | Agent display name                                  |
| description    | TEXT          | YES      | NULL              | Agent purpose description                           |
| goal           | TEXT          | NO       | -                 | The agent's primary goal/objective                  |
| system_prompt  | TEXT          | NO       | -                 | System prompt for LLM                               |
| model_provider | TEXT          | NO       | -                 | 'openai' / 'anthropic' / 'gemini'                   |
| model_name     | TEXT          | NO       | -                 | Specific model (e.g., 'gpt-4o', 'claude-3-5-sonnet')|
| max_steps      | INTEGER       | NO       | 10                | Maximum iterations before forced stop               |
| temperature    | DECIMAL(3,2)  | NO       | 0.7               | LLM temperature setting                             |
| is_active      | BOOLEAN       | NO       | true              | Whether agent is available for use                  |
| created_at     | TIMESTAMPTZ   | NO       | now()             | Record creation time                                |
| updated_at     | TIMESTAMPTZ   | NO       | now()             | Last update time                                    |

**Constraints:**
- PRIMARY KEY: `agent_id`
- FOREIGN KEY: `tenant_id` REFERENCES `tenants(tenant_id)` ON DELETE CASCADE
- FOREIGN KEY: `user_id` REFERENCES `users(user_id)` ON DELETE SET NULL
- UNIQUE: `(tenant_id, name)`

**Indexes:**
- `idx_agents_tenant_id` on `tenant_id`

---

#### 2. `agent_sessions` - Session Memory (Conversations)

| Column       | Type        | Nullable | Default           | Description                                      |
|--------------|-------------|----------|-------------------|--------------------------------------------------|
| session_id   | UUID        | NO       | gen_random_uuid() | Primary key                                      |
| agent_id     | UUID        | NO       | -                 | Reference to agent                               |
| user_id      | UUID        | NO       | -                 | User who started session                         |
| tenant_id    | UUID        | NO       | -                 | Reference to tenant                              |
| title        | TEXT        | YES      | NULL              | Session title (auto-generated or user-set)       |
| status       | TEXT        | NO       | 'active'          | 'active' / 'completed' / 'failed' / 'cancelled'  |
| current_step | INTEGER     | NO       | 0                 | Current step in the loop                         |
| goal_met     | BOOLEAN     | NO       | false             | Whether the goal was achieved                    |
| started_at   | TIMESTAMPTZ | NO       | now()             | Session start time                               |
| ended_at     | TIMESTAMPTZ | YES      | NULL              | Session end time                                 |
| created_at   | TIMESTAMPTZ | NO       | now()             | Record creation time                             |

**Constraints:**
- PRIMARY KEY: `session_id`
- FOREIGN KEY: `agent_id` REFERENCES `agents(agent_id)` ON DELETE CASCADE
- FOREIGN KEY: `user_id` REFERENCES `users(user_id)` ON DELETE CASCADE
- FOREIGN KEY: `tenant_id` REFERENCES `tenants(tenant_id)` ON DELETE CASCADE

**Indexes:**
- `idx_agent_sessions_agent_id` on `agent_id`
- `idx_agent_sessions_user_id` on `user_id`
- `idx_agent_sessions_tenant_id` on `tenant_id`

---

#### 3. `agent_session_messages` - Session Message History

| Column      | Type        | Nullable | Default           | Description                                |
|-------------|-------------|----------|-------------------|--------------------------------------------|
| message_id  | UUID        | NO       | gen_random_uuid() | Primary key                                |
| session_id  | UUID        | NO       | -                 | Reference to session                       |
| step_number | INTEGER     | NO       | -                 | Which step this message belongs to         |
| role        | TEXT        | NO       | -                 | 'user' / 'assistant' / 'tool' / 'system'   |
| content     | TEXT        | NO       | -                 | Message content                            |
| tool_name   | TEXT        | YES      | NULL              | Tool name if role='tool'                   |
| tool_input  | JSONB       | YES      | NULL              | Tool input parameters                      |
| tool_output | JSONB       | YES      | NULL              | Tool execution result                      |
| reasoning   | TEXT        | YES      | NULL              | LLM's reasoning (chain-of-thought)         |
| tokens_used | INTEGER     | YES      | NULL              | Token count for this message               |
| created_at  | TIMESTAMPTZ | NO       | now()             | Record creation time                       |

**Constraints:**
- PRIMARY KEY: `message_id`
- FOREIGN KEY: `session_id` REFERENCES `agent_sessions(session_id)` ON DELETE CASCADE

**Indexes:**
- `idx_session_messages_session_id` on `session_id`
- `idx_session_messages_step` on `(session_id, step_number)`

---

#### 4. `agent_long_term_memory` - Persistent Knowledge

| Column            | Type        | Nullable | Default           | Description                                          |
|-------------------|-------------|----------|-------------------|------------------------------------------------------|
| memory_id         | UUID        | NO       | gen_random_uuid() | Primary key                                          |
| agent_id          | UUID        | NO       | -                 | Reference to agent                                   |
| tenant_id         | UUID        | NO       | -                 | Reference to tenant                                  |
| memory_type       | TEXT        | NO       | 'fact'            | 'fact' / 'preference' / 'learned' / 'user_provided'  |
| content           | TEXT        | NO       | -                 | The memory content                                   |
| source_session_id | UUID        | YES      | NULL              | Session where memory was created                     |
| importance        | INTEGER     | NO       | 5                 | 1-10 importance score                                |
| last_accessed_at  | TIMESTAMPTZ | YES      | NULL              | When memory was last used                            |
| access_count      | INTEGER     | NO       | 0                 | How many times memory was retrieved                  |
| is_active         | BOOLEAN     | NO       | true              | Whether memory is active                             |
| created_at        | TIMESTAMPTZ | NO       | now()             | Record creation time                                 |
| updated_at        | TIMESTAMPTZ | NO       | now()             | Last update time                                     |

**Constraints:**
- PRIMARY KEY: `memory_id`
- FOREIGN KEY: `agent_id` REFERENCES `agents(agent_id)` ON DELETE CASCADE
- FOREIGN KEY: `tenant_id` REFERENCES `tenants(tenant_id)` ON DELETE CASCADE
- FOREIGN KEY: `source_session_id` REFERENCES `agent_sessions(session_id)` ON DELETE SET NULL

**Indexes:**
- `idx_long_term_memory_agent_id` on `agent_id`
- `idx_long_term_memory_type` on `(agent_id, memory_type)`
- `idx_long_term_memory_importance` on `(agent_id, importance DESC)`

---

#### 5. `agent_tools` - Tool Registry

| Column       | Type        | Nullable | Default           | Description                      |
|--------------|-------------|----------|-------------------|----------------------------------|
| tool_id      | UUID        | NO       | gen_random_uuid() | Primary key                      |
| tenant_id    | UUID        | NO       | -                 | Reference to tenant              |
| user_id      | UUID        | NO       | -                 | Creator of tool                  |
| name         | TEXT        | NO       | -                 | Tool name (function name)        |
| description  | TEXT        | NO       | -                 | What the tool does (for LLM)     |
| tool_type    | TEXT        | NO       | -                 | 'mcp_server' / 'python_script'   |
| input_schema | JSONB       | NO       | -                 | JSON Schema for tool inputs      |
| is_active    | BOOLEAN     | NO       | true              | Whether tool is available        |
| created_at   | TIMESTAMPTZ | NO       | now()             | Record creation time             |
| updated_at   | TIMESTAMPTZ | NO       | now()             | Last update time                 |

**Constraints:**
- PRIMARY KEY: `tool_id`
- FOREIGN KEY: `tenant_id` REFERENCES `tenants(tenant_id)` ON DELETE CASCADE
- FOREIGN KEY: `user_id` REFERENCES `users(user_id)` ON DELETE SET NULL
- UNIQUE: `(tenant_id, name)`

**Indexes:**
- `idx_agent_tools_tenant_id` on `tenant_id`
- `idx_agent_tools_type` on `(tenant_id, tool_type)`

---

#### 6. `mcp_servers` - MCP Server Configurations

| Column            | Type        | Nullable | Default           | Description                               |
|-------------------|-------------|----------|-------------------|-------------------------------------------|
| mcp_server_id     | UUID        | NO       | gen_random_uuid() | Primary key                               |
| tool_id           | UUID        | NO       | -                 | Reference to agent_tools                  |
| tenant_id         | UUID        | NO       | -                 | Reference to tenant                       |
| server_name       | TEXT        | NO       | -                 | Display name                              |
| server_url        | TEXT        | NO       | -                 | MCP server endpoint URL                   |
| auth_type         | TEXT        | NO       | 'none'            | 'none' / 'api_key' / 'bearer' / 'basic'   |
| auth_config       | JSONB       | YES      | NULL              | Encrypted auth configuration              |
| health_status     | TEXT        | NO       | 'unknown'         | 'healthy' / 'unhealthy' / 'unknown'       |
| last_health_check | TIMESTAMPTZ | YES      | NULL              | Last health check time                    |
| created_at        | TIMESTAMPTZ | NO       | now()             | Record creation time                      |
| updated_at        | TIMESTAMPTZ | NO       | now()             | Last update time                          |

**Constraints:**
- PRIMARY KEY: `mcp_server_id`
- FOREIGN KEY: `tool_id` REFERENCES `agent_tools(tool_id)` ON DELETE CASCADE
- FOREIGN KEY: `tenant_id` REFERENCES `tenants(tenant_id)` ON DELETE CASCADE

**Indexes:**
- `idx_mcp_servers_tenant_id` on `tenant_id`
- `idx_mcp_servers_tool_id` on `tool_id`

---

#### 7. `python_scripts` - Python Script Metadata

| Column          | Type        | Nullable | Default           | Description                   |
|-----------------|-------------|----------|-------------------|-------------------------------|
| script_id       | UUID        | NO       | gen_random_uuid() | Primary key                   |
| tool_id         | UUID        | NO       | -                 | Reference to agent_tools      |
| tenant_id       | UUID        | NO       | -                 | Reference to tenant           |
| script_name     | TEXT        | NO       | -                 | Display name                  |
| blob_key        | TEXT        | NO       | -                 | Key in Netlify Blob storage   |
| file_hash       | TEXT        | YES      | NULL              | SHA-256 hash for integrity    |
| file_size       | INTEGER     | YES      | NULL              | Size in bytes                 |
| python_version  | TEXT        | NO       | '3.11'            | Required Python version       |
| dependencies    | JSONB       | YES      | '[]'              | List of pip dependencies      |
| timeout_seconds | INTEGER     | NO       | 30                | Execution timeout             |
| created_at      | TIMESTAMPTZ | NO       | now()             | Record creation time          |
| updated_at      | TIMESTAMPTZ | NO       | now()             | Last update time              |

**Constraints:**
- PRIMARY KEY: `script_id`
- FOREIGN KEY: `tool_id` REFERENCES `agent_tools(tool_id)` ON DELETE CASCADE
- FOREIGN KEY: `tenant_id` REFERENCES `tenants(tenant_id)` ON DELETE CASCADE
- UNIQUE: `blob_key`

**Indexes:**
- `idx_python_scripts_tenant_id` on `tenant_id`
- `idx_python_scripts_tool_id` on `tool_id`
- `idx_python_scripts_blob_key` on `blob_key`

**Notes:**
- Python scripts are stored in Netlify Blob storage (store: `agent-scripts`)
- Only metadata is stored in database for security
- `blob_key` references the actual script file

---

#### 8. `agent_tool_assignments` - Which Tools an Agent Can Use

| Column        | Type        | Nullable | Default           | Description                        |
|---------------|-------------|----------|-------------------|------------------------------------|
| assignment_id | UUID        | NO       | gen_random_uuid() | Primary key                        |
| agent_id      | UUID        | NO       | -                 | Reference to agent                 |
| tool_id       | UUID        | NO       | -                 | Reference to tool                  |
| is_required   | BOOLEAN     | NO       | false             | Whether tool is required for agent |
| created_at    | TIMESTAMPTZ | NO       | now()             | Record creation time               |

**Constraints:**
- PRIMARY KEY: `assignment_id`
- FOREIGN KEY: `agent_id` REFERENCES `agents(agent_id)` ON DELETE CASCADE
- FOREIGN KEY: `tool_id` REFERENCES `agent_tools(tool_id)` ON DELETE CASCADE
- UNIQUE: `(agent_id, tool_id)`

**Indexes:**
- `idx_tool_assignments_agent_id` on `agent_id`
- `idx_tool_assignments_tool_id` on `tool_id`

---

## Netlify Blob Storage

### New Blob Store: `agent-scripts`

Store Python scripts separately from user files for security isolation.

| Key Pattern                  | Content            |
|------------------------------|--------------------|
| `{tenant_id}/{script_id}.py` | Python script file |

**Security Considerations:**
- Scripts are NOT stored in database (prevents SQL injection of code)
- Scripts are tenant-isolated by key prefix
- Scripts should be validated before storage (syntax check)
- Execution happens in sandboxed environment

---

## Database Relationships

```
agents (1) ──────< agent_sessions >────── (N) agent_session_messages
       │
       └──────< agent_long_term_memory
       │
       └──────< agent_tool_assignments >────── agent_tools
                                                    │
                                    ┌───────────────┴───────────────┐
                                    │                               │
                              mcp_servers                    python_scripts
                                                                    │
                                                            (blob storage)
```

---

## API Design Standards

All API endpoints must follow the patterns defined in `api-design.md`.

### Response Structure

**Success Response:**
```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
```

**Error Response:**
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
```

### Error Codes

| Code                     | HTTP Status | Description                    |
|--------------------------|-------------|--------------------------------|
| `VALIDATION_ERROR`       | 400         | Invalid input data             |
| `AUTHENTICATION_REQUIRED`| 401         | Missing or invalid auth token  |
| `FORBIDDEN`              | 403         | Insufficient permissions       |
| `NOT_FOUND`              | 404         | Resource doesn't exist         |
| `DUPLICATE_RESOURCE`     | 409         | Resource already exists        |
| `INTERNAL_ERROR`         | 500         | Unexpected server error        |

### HTTP Status Codes

| Code | Meaning      | Use Case                       |
|------|--------------|--------------------------------|
| 200  | OK           | Successful GET, PUT, PATCH     |
| 201  | Created      | Successful POST                |
| 202  | Accepted     | Background job triggered       |
| 204  | No Content   | Successful DELETE              |
| 400  | Bad Request  | Invalid input                  |
| 401  | Unauthorized | Missing/invalid auth           |
| 403  | Forbidden    | Insufficient permissions       |
| 404  | Not Found    | Resource doesn't exist         |
| 409  | Conflict     | Duplicate resource             |
| 429  | Too Many     | Rate limit exceeded            |
| 500  | Server Error | Unexpected errors              |

### Security Headers

All responses must include:
```typescript
const securityHeaders = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
```

### Function Template

```typescript
import type { Context } from '@netlify/functions';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

export default async function handler(req: Request, context: Context) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 1. Authenticate
    const authResult = await authenticateRequest(req);
    if (!authResult.success) {
      return createErrorResponse('AUTHENTICATION_REQUIRED', 'Missing authorization', 401);
    }

    // 2. Validate input
    // 3. Authorize (check tenant membership, ownership)
    // 4. Process business logic
    // 5. Return response

    return createSuccessResponse(data, 200);
  } catch (error) {
    console.error('Function error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An error occurred', 500);
  }
}
```

### API Checklist

- [ ] Input validation implemented
- [ ] Error handling complete
- [ ] Authentication/authorization checked
- [ ] Response structure follows standard
- [ ] Appropriate status codes used
- [ ] Security headers included
- [ ] Logging implemented (sanitized)
- [ ] Performance acceptable

---

## API Endpoints

### Agents CRUD

| Method | Endpoint           | Description                |
|--------|--------------------|----------------------------|
| GET    | `/api/agents`      | List all agents for tenant |
| GET    | `/api/agents/:id`  | Get agent details          |
| POST   | `/api/agents`      | Create new agent           |
| PUT    | `/api/agents/:id`  | Update agent               |
| DELETE | `/api/agents/:id`  | Delete agent               |

### Agent Sessions

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| GET    | `/api/agents/:id/sessions`        | List sessions for agent            |
| GET    | `/api/agent-sessions/:id`         | Get session with messages          |
| POST   | `/api/agents/:id/sessions`        | Start new session                  |
| POST   | `/api/agent-sessions/:id/message` | Send message (triggers agent loop) |
| POST   | `/api/agent-sessions/:id/cancel`  | Cancel running session             |
| DELETE | `/api/agent-sessions/:id`         | Delete session                     |
| GET    | `/api/agent-sessions/:id/status`  | Poll for session status (202→200)  |

### Long-Term Memory

| Method | Endpoint                   | Description             |
|--------|----------------------------|-------------------------|
| GET    | `/api/agents/:id/memories` | List memories for agent |
| POST   | `/api/agents/:id/memories` | Add memory manually     |
| PUT    | `/api/agent-memories/:id`  | Update memory           |
| DELETE | `/api/agent-memories/:id`  | Delete memory           |

### Tools

| Method | Endpoint              | Description               |
|--------|-----------------------|---------------------------|
| GET    | `/api/tools`          | List all tools for tenant |
| GET    | `/api/tools/:id`      | Get tool details          |
| POST   | `/api/tools`          | Create new tool           |
| PUT    | `/api/tools/:id`      | Update tool               |
| DELETE | `/api/tools/:id`      | Delete tool               |
| POST   | `/api/tools/:id/test` | Test tool execution       |

### MCP Servers

| Method | Endpoint                      | Description         |
|--------|-------------------------------|---------------------|
| GET    | `/api/mcp-servers`            | List MCP servers    |
| POST   | `/api/mcp-servers`            | Add MCP server      |
| PUT    | `/api/mcp-servers/:id`        | Update MCP server   |
| DELETE | `/api/mcp-servers/:id`        | Remove MCP server   |
| POST   | `/api/mcp-servers/:id/health` | Check server health |

### Python Scripts

| Method | Endpoint                           | Description          |
|--------|------------------------------------|----------------------|
| GET    | `/api/python-scripts`              | List scripts         |
| GET    | `/api/python-scripts/:id`          | Get script metadata  |
| GET    | `/api/python-scripts/:id/download` | Download script file |
| POST   | `/api/python-scripts`              | Upload new script    |
| PUT    | `/api/python-scripts/:id`          | Update script        |
| DELETE | `/api/python-scripts/:id`          | Delete script        |

---

## LLM Integration (Netlify AI Gateway)

All LLM interactions MUST use the Netlify AI Gateway. This provides unified access to OpenAI, Anthropic, and Google Gemini without managing separate API keys.

### Supported Providers

| Provider  | Client Library         | Auto-Injected Env Vars                        |
|-----------|------------------------|-----------------------------------------------|
| OpenAI    | `openai`               | `OPENAI_API_KEY`, `OPENAI_BASE_URL`           |
| Anthropic | `@anthropic-ai/sdk`    | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`     |
| Google    | `@google/generative-ai`| `GEMINI_API_KEY`, `GOOGLE_GEMINI_BASE_URL`    |

### LLM Client Implementation

```typescript
// lib/llm-client.ts
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Clients auto-detect env vars from Netlify AI Gateway
const openai = new OpenAI();
const anthropic = new Anthropic();

export async function callLLM(
  provider: 'openai' | 'anthropic' | 'gemini',
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<{ text: string; tokensUsed: number }> {
  const { maxTokens = 1024, temperature = 0.7 } = options;

  try {
    if (provider === 'openai') {
      const response = await openai.chat.completions.create({
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        max_tokens: maxTokens,
        temperature,
      });
      return {
        text: response.choices[0]?.message?.content || '',
        tokensUsed: response.usage?.total_tokens || 0,
      };
    }

    if (provider === 'anthropic') {
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        messages: messages as Anthropic.MessageParam[],
      });
      const textBlock = response.content.find((b) => b.type === 'text');
      return {
        text: textBlock && 'text' in textBlock ? textBlock.text : '',
        tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      };
    }

    if (provider === 'gemini') {
      // Gemini requires explicit API key
      const response = await fetch(
        `${process.env.GOOGLE_GEMINI_BASE_URL}/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY!,
          },
          body: JSON.stringify({
            contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
          }),
        }
      );
      const data = await response.json();
      return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        tokensUsed: data.usageMetadata?.totalTokenCount || 0,
      };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  } catch (error) {
    // Handle rate limiting with backoff
    if (error instanceof OpenAI.APIError && error.status === 429) {
      throw new Error('Rate limited by AI provider. Please try again.');
    }
    throw error;
  }
}
```

### Prompt Sanitization

```typescript
// lib/prompt-utils.ts
export function sanitizeUserInput(input: string): string {
  return input
    .replace(/```/g, '')           // Remove code blocks that could inject
    .replace(/\n{3,}/g, '\n\n')    // Normalize whitespace
    .slice(0, 10000);              // Limit length
}
```

### AI Gateway Checklist

- [ ] Use official client libraries (no direct REST unless necessary)
- [ ] Rely on auto-injected environment variables (no hardcoded keys)
- [ ] Implement rate limiting on agent endpoints
- [ ] Handle API errors gracefully (429, 400, 500)
- [ ] Set reasonable max_tokens limits per request
- [ ] Sanitize user input before including in prompts
- [ ] Never log prompts or responses containing user data
- [ ] Deploy to production before testing AI features

---

## Background Functions

### `agent-loop-background.ts`

The core agent execution loop runs as a background function (15-minute timeout).

```typescript
// Pseudocode
import { callLLM } from './lib/llm-client';
import { sanitizeUserInput } from './lib/prompt-utils';

async function agentLoop(sessionId: string) {
  const session = await getSession(sessionId);
  const agent = await getAgent(session.agent_id);
  const tools = await getAgentTools(agent.agent_id);
  const memories = await getRelevantMemories(agent.agent_id, session.context);
  
  while (!session.goal_met && session.current_step < agent.max_steps) {
    // 1. Build context with memories and history
    const context = buildContext(session, memories);
    
    // 2. Ask LLM to reason and choose action (via AI Gateway)
    const messages = buildMessages(agent.system_prompt, context, tools);
    const response = await callLLM(
      agent.model_provider,
      agent.model_name,
      messages,
      { maxTokens: 2048, temperature: agent.temperature }
    );
    
    // 3. Parse LLM decision
    const decision = parseDecision(response.text);
    await saveMessage(session, 'assistant', response.text, response.tokensUsed);
    
    // 4. Execute tool if chosen
    if (decision.tool) {
      const result = await executeTool(decision.tool, decision.input);
      await saveMessage(session, 'tool', result);
    }
    
    // 5. Check if goal is met
    if (decision.goal_met) {
      session.goal_met = true;
      session.status = 'completed';
    }
    
    // 6. Update state
    session.current_step++;
    await updateSession(session);
  }
  
  // 7. Extract and save any new long-term memories
  await extractMemories(session);
}
```

### `python-executor-background.ts`

Executes Python scripts in a sandboxed environment.

**Open Question:** How to safely execute Python scripts?
- Option A: Use a Python runtime service (e.g., AWS Lambda with Python)
- Option B: Use a containerized execution environment
- Option C: Use a third-party code execution API (e.g., Judge0, Piston)
- Option D: Limit to pre-approved scripts only

---

## Frontend Component Standards

All frontend components must follow the patterns defined in `frontend-components.md`.

### Core Principles

- Build small, focused, reusable components (max 200 lines)
- Use shadcn/ui components when available
- Use Tailwind CSS for styling (no inline styles)
- Support `className` prop for customization
- Handle loading and error states
- Follow WCAG 2.1 AA accessibility guidelines

### Required shadcn/ui Components

| Component Need       | shadcn/ui Component | Usage                           |
|----------------------|---------------------|----------------------------------|
| Agent selector       | `Select`            | Dropdown for agent selection     |
| Session list         | `ScrollArea`        | Scrollable session sidebar       |
| Chat input           | `Input`, `Button`   | Message input form               |
| Agent form           | `Form`, `Input`     | Create/edit agent                |
| Modals               | `Dialog`            | Confirmations, detail views      |
| Tool cards           | `Card`              | Display tool info                |
| Memory list          | `Table`             | Memory management                |
| Loading states       | `Skeleton`          | Loading placeholders             |
| Notifications        | `Toast`             | Success/error messages           |

### Component Structure Pattern

```typescript
// 1. Imports (React, libraries, internal)
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 2. Types
interface AgentCardProps {
  agent: Agent;
  onSelect?: (agent: Agent) => void;
  className?: string;
}

// 3. Component
export function AgentCard({ agent, onSelect, className }: AgentCardProps) {
  // 3a. Hooks
  const [isLoading, setIsLoading] = useState(false);

  // 3b. Handlers
  const handleClick = () => {
    onSelect?.(agent);
  };

  // 3c. Render
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      {/* content */}
    </div>
  );
}
```

### Accessibility Requirements

- All interactive elements must be keyboard accessible
- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Add `aria-label` for icon-only buttons
- Support Escape to close modals
- Visible focus indicators required
- Test with screen readers

### Component Checklist

- [ ] Props interface defined with TypeScript
- [ ] No `any` types
- [ ] Uses shadcn/ui where applicable
- [ ] Tailwind classes organized (layout → sizing → typography → visual → interactive)
- [ ] Accessible (keyboard, screen reader)
- [ ] Handles loading state
- [ ] Handles error state
- [ ] Responsive design verified
- [ ] Dark mode works
- [ ] Tests written

---

## UI Components

### Navigation

Add to left nav panel:
```
- Dashboard
- AI Gateway Chat
- **Agent Mode Chat** ← NEW
- File Storage
- RAG Preprocessing
- Admin
```

### Pages

#### 1. Agent Mode Chat Page (`/agent-chat`)

Main chat interface with agent selection.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Agent Mode Chat                              [Select Agent ▼]   │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────────────────────────────┐ │
│ │ Sessions        │ │ Chat Area                               │ │
│ │                 │ │                                         │ │
│ │ • Session 1     │ │ [User message]                          │ │
│ │ • Session 2     │ │                                         │ │
│ │ • Session 3     │ │ [Agent reasoning...]                    │ │
│ │                 │ │ [Tool: search_docs]                     │ │
│ │ [+ New Session] │ │ [Tool result]                           │ │
│ │                 │ │                                         │ │
│ │                 │ │ [Agent response]                        │ │
│ │                 │ │                                         │ │
│ └─────────────────┘ │                                         │ │
│                     │ ┌─────────────────────────────────────┐ │ │
│                     │ │ Ask a question...              [Send]│ │ │
│                     │ └─────────────────────────────────────┘ │ │
│                     └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Agent selector dropdown
- Session list sidebar
- Chat messages with role indicators
- Tool execution visualization (collapsible)
- Reasoning display (optional, collapsible)
- Step counter and progress
- Cancel button for running sessions

#### 2. Agent Management Page (`/agent-chat/agents`)

CRUD interface for agents.

**Features:**
- List of agents with status
- Create/Edit agent form:
  - Name, Description
  - Goal
  - System Prompt (with templates)
  - Model Provider & Model selection
  - Max steps, Temperature
  - Tool assignments (multi-select)
- View agent details with stats
- Delete with confirmation

#### 3. Tools Management Page (`/agent-chat/tools`)

CRUD interface for tools.

**Features:**
- List of tools by type (MCP / Python)
- Create tool wizard:
  - Select type
  - Configure MCP server OR upload Python script
  - Define input schema
  - Test tool
- Edit tool configuration
- Delete with confirmation

#### 4. Memory Management Page (`/agent-chat/memories`)

View and manage long-term memories.

**Features:**
- Filter by agent
- Filter by memory type
- Search memories
- Add manual memories
- Edit/Delete memories
- View memory usage stats

---

## Code Quality Standards

All code must follow the patterns defined in `code-quality.md`.

### TypeScript Requirements

- **Strict mode enabled** - No implicit any, strict null checks
- **No `any` type** - Use `unknown` and narrow appropriately
- **Explicit return types** for all exported functions
- **Interfaces for object shapes**, types for unions/primitives
- **No `@ts-ignore`** without documented justification

### Naming Conventions

| Type               | Convention        | Example                    |
|--------------------|-------------------|----------------------------|
| React components   | PascalCase        | `AgentChatPage.tsx`        |
| Hooks              | camelCase + `use` | `useAgentSession.ts`       |
| Utilities          | camelCase         | `formatAgentResponse.ts`   |
| Types/Interfaces   | PascalCase        | `AgentSession`             |
| Constants          | SCREAMING_SNAKE   | `MAX_AGENT_STEPS`          |
| Directories        | kebab-case        | `agent-chat/`              |
| Database columns   | snake_case        | `agent_id`, `created_at`   |

### File Organization

- One component per file (except small helper components)
- Imports at top of file, grouped: React → third-party → internal → types
- Maximum 50 lines per function (guideline)
- Maximum cyclomatic complexity: 10
- Use early returns to reduce nesting

### Required Patterns

```typescript
// Explicit return types for exported functions
export async function getAgent(agentId: string): Promise<Agent | null> {
  // ...
}

// Interface for component props
interface AgentSelectorProps {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (agentId: string) => void;
}

// Discriminated unions for state
type SessionStatus = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; data: Session };
```

### Code Quality Checklist

- [ ] TypeScript compiles without errors
- [ ] ESLint passes without warnings
- [ ] No `any` types without justification
- [ ] Error cases are handled
- [ ] Loading states are handled
- [ ] Names are clear and descriptive
- [ ] Complex logic is documented
- [ ] No console.log statements (except intentional logging)

---

## File Structure

### New Files to Create

```
src/
├── pages/
│   └── agent-chat/
│       ├── AgentChatPage.tsx           # Main chat interface
│       ├── AgentManagementPage.tsx     # Agent CRUD
│       ├── ToolsManagementPage.tsx     # Tools CRUD
│       ├── MemoryManagementPage.tsx    # Memory management
│       └── components/
│           ├── AgentSelector.tsx
│           ├── SessionList.tsx
│           ├── ChatMessage.tsx
│           ├── ToolExecutionCard.tsx
│           ├── ReasoningDisplay.tsx
│           ├── AgentForm.tsx
│           ├── ToolForm.tsx
│           ├── McpServerForm.tsx
│           ├── PythonScriptUpload.tsx
│           └── MemoryCard.tsx

netlify/
└── functions/
    ├── agents.ts                       # Agent CRUD
    ├── agent-sessions.ts               # Session management
    ├── agent-loop-background.ts        # Agent execution loop
    ├── agent-memories.ts               # Memory CRUD
    ├── agent-tools.ts                  # Tools CRUD
    ├── mcp-servers.ts                  # MCP server management
    ├── python-scripts.ts               # Python script management
    └── python-executor-background.ts   # Script execution

migrations/
├── 009_agents_table.sql
├── 010_agent_sessions_tables.sql
├── 011_agent_memory_table.sql
├── 012_agent_tools_tables.sql
└── 013_mcp_python_tables.sql
```

---

## Implementation Phases

### Phase 1: Database & Core Infrastructure
- [ ] Create migration files for all new tables
- [ ] Update `db_ref.md` with new schema
- [ ] Create Netlify Blob store `agent-scripts`
- [ ] Implement basic agent CRUD API

### Phase 2: Agent Management UI
- [ ] Create Agent Management page
- [ ] Agent list with search/filter
- [ ] Agent create/edit form
- [ ] Agent delete with confirmation
- [ ] Add navigation link

### Phase 3: Tools Infrastructure
- [ ] Implement tools CRUD API
- [ ] Implement MCP server management API
- [ ] Implement Python script upload/storage API
- [ ] Create Tools Management page
- [ ] MCP server configuration form
- [ ] Python script upload form
- [ ] Tool testing interface

### Phase 4: Session & Memory
- [ ] Implement session management API
- [ ] Implement memory CRUD API
- [ ] Create Memory Management page
- [ ] Session list component
- [ ] Memory list with filters

### Phase 5: Agent Loop (Core)
- [ ] Implement `agent-loop-background.ts`
- [ ] LLM integration for reasoning
- [ ] Tool execution dispatcher
- [ ] Memory retrieval during loop
- [ ] Memory extraction after session

### Phase 6: Chat Interface
- [ ] Create Agent Chat page
- [ ] Agent selector
- [ ] Session sidebar
- [ ] Chat message display
- [ ] Tool execution visualization
- [ ] Reasoning display (collapsible)
- [ ] Input form with send
- [ ] Cancel session button

### Phase 7: Python Execution (Deferred)
- [ ] Research safe execution options
- [ ] Implement chosen solution
- [ ] Add execution timeout handling
- [ ] Add output capture

### Phase 8: Polish & Testing
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success notifications
- [ ] Write tests for agent loop
- [ ] Write tests for tool execution
- [ ] Write tests for UI components

---

## Open Questions

### 1. Python Script Execution
**Question:** How should we safely execute user-uploaded Python scripts?

Options:
- A) External service (AWS Lambda, Google Cloud Functions)
- B) Containerized execution (Docker)
- C) Third-party API (Judge0, Piston)
- D) Pre-approved scripts only (no user uploads)
- E) Defer Python support to later phase

### 2. MCP Server Authentication
**Question:** How should we store MCP server credentials securely?

Options:
- A) Encrypted in database (using Netlify environment secret as key)
- B) Netlify environment variables per server
- C) External secrets manager

### 3. Memory Extraction
**Question:** Should the agent automatically extract memories, or should users manually add them?

Options:
- A) Automatic extraction by LLM at end of session
- B) User manually adds memories
- C) Both (auto-suggest, user confirms)

### 4. Multi-Agent Support
**Question:** Should we support multiple agents collaborating in one session?

Options:
- A) Single agent per session (simpler, recommended for v1)
- B) Multi-agent with handoffs (complex, defer to v2)

### 5. Tool Permissions
**Question:** Should tools have permission levels?

Options:
- A) All tools available to all agents
- B) Tools assigned per agent (current design)
- C) Tools have permission levels (read-only, write, admin)

### 6. Session Persistence
**Question:** How long should sessions be retained?

Options:
- A) Forever (user deletes manually)
- B) Auto-delete after X days
- C) Configurable per tenant

### 7. Rate Limiting
**Question:** How should we rate limit agent executions?

Options:
- A) Max concurrent sessions per user
- B) Max steps per day per tenant
- C) Token budget per tenant
- D) All of the above

### 8. Streaming
**Question:** Should agent responses stream to the UI?

Options:
- A) No streaming (simpler, current design)
- B) Stream LLM responses only
- C) Stream everything including tool results

---

## Security Standards

All security practices must follow the patterns defined in `security.md`.

### Authentication & Authorization

- All agent endpoints require JWT authentication
- Verify user ownership before any data access
- Check tenant membership for all agent/tool/memory operations
- Store auth tokens in `localStorage` under key `"auth_token"`
- Clear tokens on sign-out and on 401 responses

### Data Protection

| Data Type              | Protection                                      |
|------------------------|--------------------------------------------------|
| MCP server credentials | Encrypted in database (AES-256)                  |
| Python scripts         | Stored in Blob storage, not database             |
| Session messages       | Tenant-isolated, user-scoped                     |
| Long-term memories     | Tenant-isolated, agent-scoped                    |
| Tool inputs/outputs    | Validated, sanitized, not logged in full         |

### Logging Rules

**What to Log:**
- Authentication events (success/failure, without credentials)
- Agent session start/end
- Tool execution events (tool name, success/failure)
- Errors (sanitized, no sensitive data)

**What to NEVER Log:**
- Passwords or tokens
- Full prompt content
- Full LLM responses
- MCP server credentials
- User PII in messages
- Tool input/output containing sensitive data

### Input Validation

```typescript
// Validate all user inputs before processing
function validateAgentInput(input: unknown): AgentInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid input');
  }
  // Validate required fields, types, lengths
  // Sanitize strings before database operations
}
```

### Security Checklist

- [ ] All endpoints require authentication
- [ ] Tenant isolation enforced on all queries
- [ ] User ownership verified before data access
- [ ] Tool inputs validated before execution
- [ ] Python scripts validated before storage (syntax check)
- [ ] MCP server credentials encrypted at rest
- [ ] Rate limiting implemented on agent endpoints
- [ ] Audit log for tool executions (sanitized)
- [ ] Prompt injection prevention (sanitize user messages)
- [ ] Timeout on all external calls (LLM, MCP, Python)
- [ ] No sensitive data in error messages
- [ ] No sensitive data logged

---

## Dependencies

### Required NPM Packages

| Package                  | Purpose                              | Notes                              |
|--------------------------|--------------------------------------|------------------------------------|
| `openai`                 | OpenAI API client                    | Auto-detects AI Gateway env vars   |
| `@anthropic-ai/sdk`      | Anthropic API client                 | Auto-detects AI Gateway env vars   |
| `@google/generative-ai`  | Google Gemini client (optional)      | Requires explicit API key          |
| `@netlify/blobs`         | Script storage                       | Already installed                  |
| `@neondatabase/serverless`| Database                            | Already installed                  |
| `lucide-react`           | Icons                                | Already installed                  |

### Potential Additional Packages
- MCP client library if using MCP protocol
- Python execution library depending on chosen approach

---

## Success Criteria

An agent is working correctly when:
- [ ] LLM chooses which tool to call (not hardcoded)
- [ ] Agent can take multiple steps
- [ ] Agent can fail and recover
- [ ] Agent can stop itself when goal is met
- [ ] New tools can be added without changing agent logic
- [ ] Session memory persists across messages
- [ ] Long-term memory persists across sessions

---

*This plan file outlines the complete Agent Mode Chat feature. Review and answer open questions before implementation.*
