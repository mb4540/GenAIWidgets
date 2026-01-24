# Database Reference

**Single Source of Truth for Database Schema**

*Last Updated: [DATE]*

---

## Overview

This document contains the authoritative schema definition for the project database. All database-related code must reference this file.

---

## Tables

### users

User account information.

| Column            | Type        | Nullable | Default           | Description              |
|-------------------|-------------|----------|-------------------|--------------------------|
| user_id           | UUID        | NO       | gen_random_uuid() | Primary key              |
| email             | TEXT        | NO       | -                 | Unique email address     |
| password_hash     | TEXT        | NO       | -                 | bcrypt hashed password   |
| full_name         | TEXT        | NO       | -                 | User's display name      |
| phone             | TEXT        | YES      | NULL              | Phone number             |
| phone_verified_at | TIMESTAMPTZ | YES      | NULL              | When phone was verified  |
| created_at        | TIMESTAMPTZ | NO       | now()             | Record creation time     |
| updated_at        | TIMESTAMPTZ | NO       | now()             | Last update time         |

**Constraints:**
- PRIMARY KEY: `user_id`
- UNIQUE: `email`

**Indexes:**
- `idx_users_email` on `email`

---

### tenants

Multi-tenant organization records.

| Column     | Type        | Nullable | Default           | Description          |
|------------|-------------|----------|-------------------|----------------------|
| tenant_id  | UUID        | NO       | gen_random_uuid() | Primary key          |
| name       | TEXT        | NO       | -                 | Organization name    |
| slug       | TEXT        | NO       | -                 | URL-safe identifier  |
| created_at | TIMESTAMPTZ | NO       | now()             | Record creation time |

**Constraints:**
- PRIMARY KEY: `tenant_id`
- UNIQUE: `slug`

**Indexes:**
- `idx_tenants_slug` on `slug`

---

### memberships

User-tenant relationship with roles.

| Column        | Type            | Nullable | Default           | Description           |
|---------------|-----------------|----------|-------------------|-----------------------|
| membership_id | UUID            | NO       | gen_random_uuid() | Primary key           |
| tenant_id     | UUID            | NO       | -                 | Reference to tenant   |
| user_id       | UUID            | NO       | -                 | Reference to user     |
| role          | membership_role | NO       | 'member'          | User's role in tenant |
| created_at    | TIMESTAMPTZ     | NO       | now()             | Record creation time  |

**Constraints:**
- PRIMARY KEY: `membership_id`
- FOREIGN KEY: `tenant_id` REFERENCES `tenants(tenant_id)` ON DELETE CASCADE
- FOREIGN KEY: `user_id` REFERENCES `users(user_id)` ON DELETE CASCADE
- UNIQUE: `(tenant_id, user_id)`

**Indexes:**
- `idx_memberships_tenant_id` on `tenant_id`
- `idx_memberships_user_id` on `user_id`

---

### admins

System-wide administrator access (cross-tenant).

| Column     | Type        | Nullable | Default           | Description                |
|------------|-------------|----------|-------------------|----------------------------|
| admin_id   | UUID        | NO       | gen_random_uuid() | Primary key                |
| user_id    | UUID        | NO       | -                 | Reference to user (unique) |
| granted_by | UUID        | YES      | NULL              | Admin who granted access   |
| granted_at | TIMESTAMPTZ | NO       | now()             | When admin was granted     |

**Constraints:**
- PRIMARY KEY: `admin_id`
- FOREIGN KEY: `user_id` REFERENCES `users(user_id)` ON DELETE CASCADE
- FOREIGN KEY: `granted_by` REFERENCES `users(user_id)` ON DELETE SET NULL
- UNIQUE: `user_id`

**Indexes:**
- `idx_admins_user_id` on `user_id`

**Notes:**
- Admins have cross-tenant access to all features
- `granted_by` tracks who granted admin access for audit
- First admin must be seeded manually or via migration

---

### folders

Virtual directory structure for file organization.

| Column      | Type        | Nullable | Default           | Description                    |
|-------------|-------------|----------|-------------------|--------------------------------|
| folder_id   | UUID        | NO       | gen_random_uuid() | Primary key                    |
| tenant_id   | UUID        | NO       | -                 | Reference to tenant            |
| user_id     | UUID        | NO       | -                 | User who created folder        |
| folder_name | TEXT        | NO       | -                 | Folder display name            |
| folder_path | TEXT        | NO       | -                 | Full path (e.g., /docs/reports/) |
| parent_path | TEXT        | NO       | '/'               | Parent folder path             |
| created_at  | TIMESTAMPTZ | NO       | now()             | Record creation time           |

**Constraints:**
- PRIMARY KEY: `folder_id`
- FOREIGN KEY: `tenant_id` REFERENCES `tenants(tenant_id)` ON DELETE CASCADE
- FOREIGN KEY: `user_id` REFERENCES `users(user_id)` ON DELETE SET NULL
- UNIQUE: `(tenant_id, folder_path)`

**Indexes:**
- `idx_folders_tenant_id` on `tenant_id`
- `idx_folders_path` on `(tenant_id, folder_path)`

---

### files

File metadata with references to Netlify Blob storage.

| Column     | Type        | Nullable | Default           | Description                      |
|------------|-------------|----------|-------------------|----------------------------------|
| file_id    | UUID        | NO       | gen_random_uuid() | Primary key                      |
| tenant_id  | UUID        | NO       | -                 | Reference to tenant              |
| user_id    | UUID        | NO       | -                 | User who uploaded file           |
| blob_key   | TEXT        | NO       | -                 | UUID key in Netlify Blobs        |
| file_name  | TEXT        | NO       | -                 | Original filename                |
| file_path  | TEXT        | NO       | '/'               | Virtual directory path           |
| mime_type  | TEXT        | YES      | NULL              | MIME type                        |
| file_size  | BIGINT      | YES      | NULL              | Size in bytes                    |
| etag       | TEXT        | YES      | NULL              | Blob ETag for versioning         |
| created_at | TIMESTAMPTZ | NO       | now()             | Record creation time             |
| updated_at | TIMESTAMPTZ | NO       | now()             | Last update time                 |

**Constraints:**
- PRIMARY KEY: `file_id`
- FOREIGN KEY: `tenant_id` REFERENCES `tenants(tenant_id)` ON DELETE CASCADE
- FOREIGN KEY: `user_id` REFERENCES `users(user_id)` ON DELETE SET NULL
- UNIQUE: `blob_key`

**Indexes:**
- `idx_files_tenant_id` on `tenant_id`
- `idx_files_user_id` on `user_id`
- `idx_files_path` on `(tenant_id, file_path)`
- `idx_files_blob_key` on `blob_key` (unique)

**Notes:**
- `blob_key` is a UUID used to store/retrieve files from Netlify Blobs
- `file_path` is a virtual directory path, not the blob key
- Files are stored in Netlify Blobs store named `user-files`

---

## Enums

### membership_role

```sql
CREATE TYPE membership_role AS ENUM ('owner', 'member');
```

| Value  | Description                 |
|--------|-----------------------------|
| owner  | Full administrative access  |
| member | Standard member access      |

---

## Relationships

```
users (1) ──────< memberships >────── (1) tenants
         user_id              tenant_id

users (1) ──────< admins
         user_id

tenants (1) ──────< folders
           tenant_id

tenants (1) ──────< files
           tenant_id
```

- A user can belong to multiple tenants (via memberships)
- A tenant can have multiple users (via memberships)
- Each membership has exactly one user and one tenant
- A user can optionally be an admin (cross-tenant access)
- A tenant can have multiple folders and files
- Files reference Netlify Blobs via `blob_key`

---

## Row Counts

*Update these periodically for query planning*

| Table                  | Approximate Rows | Last Checked |
|------------------------|------------------|--------------|
| users                  | 0                | [DATE]       |
| tenants                | 0                | [DATE]       |
| memberships            | 0                | [DATE]       |
| admins                 | 0                | [DATE]       |
| folders                | 0                | [DATE]       |
| files                  | 0                | [DATE]       |
| agents                 | 0                | 2026-01-17   |
| agent_sessions         | 0                | 2026-01-17   |
| agent_session_messages | 0                | 2026-01-17   |
| agent_session_memory   | 0                | 2026-01-24   |
| agent_long_term_memory | 0                | 2026-01-17   |
| agent_tools            | 0                | 2026-01-17   |
| agent_tool_assignments | 0                | 2026-01-17   |
| mcp_servers            | 0                | 2026-01-17   |

---

## Migration History

| Version | File                           | Description                                     | Applied    |
|---------|--------------------------------|-------------------------------------------------|------------|
| 001     | 001_initial_schema.sql         | Initial schema with users, tenants, memberships | [DATE]     |
| 002     | 002_admins_table.sql           | Add admins table for cross-tenant access        | 2026-01-10 |
| 003     | 003_files_folders_tables.sql   | Add files and folders tables for blob storage   | 2026-01-10 |
| 009     | 009_agents_table.sql           | Add agents table for Agent Mode                 | 2026-01-17 |
| 010     | 010_agent_sessions_tables.sql  | Add agent_sessions and messages tables          | 2026-01-17 |
| 011     | 011_agent_memory_table.sql     | Add agent_long_term_memory table                | 2026-01-17 |
| 012     | 012_agent_tools_tables.sql     | Add agent_tools and assignments tables          | 2026-01-17 |
| 013     | 013_mcp_servers_table.sql      | Add mcp_servers table                           | 2026-01-17 |
| 015     | 015_agent_session_memory.sql   | Add agent_session_memory for short-term memory  | 2026-01-24 |

---

## Common Queries

### Get user with tenant info

```sql
SELECT 
  u.user_id,
  u.email,
  u.full_name,
  t.tenant_id,
  t.name AS tenant_name,
  t.slug AS tenant_slug,
  m.role
FROM users u
LEFT JOIN memberships m ON u.user_id = m.user_id
LEFT JOIN tenants t ON m.tenant_id = t.tenant_id
WHERE u.user_id = $1;
```

### Get all members of a tenant

```sql
SELECT 
  u.user_id,
  u.email,
  u.full_name,
  m.role,
  m.created_at AS joined_at
FROM memberships m
JOIN users u ON m.user_id = u.user_id
WHERE m.tenant_id = $1
ORDER BY m.created_at;
```

### Check if user is tenant member

```sql
SELECT EXISTS (
  SELECT 1 FROM memberships 
  WHERE user_id = $1 AND tenant_id = $2
) AS is_member;
```

### Check if user is admin

```sql
SELECT EXISTS (
  SELECT 1 FROM admins 
  WHERE user_id = $1
) AS is_admin;
```

### Get user with admin status

```sql
SELECT 
  u.user_id,
  u.email,
  u.full_name,
  CASE WHEN a.admin_id IS NOT NULL THEN true ELSE false END AS is_admin
FROM users u
LEFT JOIN admins a ON u.user_id = a.user_id
WHERE u.user_id = $1;
```

---

## Agent Mode Tables

### agents

Agent definitions for Agent Mode Chat feature.

| Column         | Type          | Nullable | Default           | Description                                          |
|----------------|---------------|----------|-------------------|------------------------------------------------------|
| agent_id       | UUID          | NO       | gen_random_uuid() | Primary key                                          |
| tenant_id      | UUID          | NO       | -                 | Reference to tenant                                  |
| user_id        | UUID          | NO       | -                 | Creator of agent                                     |
| name           | TEXT          | NO       | -                 | Agent display name                                   |
| description    | TEXT          | YES      | NULL              | Agent purpose description                            |
| goal           | TEXT          | NO       | -                 | The agent's primary goal/objective                   |
| system_prompt  | TEXT          | NO       | -                 | System prompt for LLM                                |
| model_provider | TEXT          | NO       | -                 | 'openai' / 'anthropic' / 'gemini'                    |
| model_name     | TEXT          | NO       | -                 | Specific model (e.g., 'gpt-4o', 'claude-3-5-sonnet') |
| max_steps      | INTEGER       | NO       | 10                | Maximum iterations before forced stop                |
| temperature    | DECIMAL(3,2)  | NO       | 0.7               | LLM temperature setting                              |
| is_active      | BOOLEAN       | NO       | true              | Whether agent is available for use                   |
| created_at     | TIMESTAMPTZ   | NO       | now()             | Record creation time                                 |
| updated_at     | TIMESTAMPTZ   | NO       | now()             | Last update time                                     |

**Constraints:**
- PRIMARY KEY: `agent_id`
- FOREIGN KEY: `tenant_id` REFERENCES `tenants(tenant_id)` ON DELETE CASCADE
- FOREIGN KEY: `user_id` REFERENCES `users(user_id)` ON DELETE SET NULL
- UNIQUE: `(tenant_id, name)`
- CHECK: `model_provider IN ('openai', 'anthropic', 'gemini')`
- CHECK: `max_steps > 0 AND max_steps <= 100`
- CHECK: `temperature >= 0 AND temperature <= 2`

**Indexes:**
- `idx_agents_tenant_id` on `tenant_id`
- `idx_agents_user_id` on `user_id`
- `idx_agents_is_active` on `(tenant_id, is_active)`

---

### agent_sessions

Agent chat sessions (session memory).

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
- CHECK: `status IN ('active', 'completed', 'failed', 'cancelled')`
- CHECK: `current_step >= 0`

**Indexes:**
- `idx_agent_sessions_agent_id` on `agent_id`
- `idx_agent_sessions_user_id` on `user_id`
- `idx_agent_sessions_tenant_id` on `tenant_id`
- `idx_agent_sessions_status` on `(agent_id, status)`

---

### agent_session_messages

Messages within agent sessions.

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
- CHECK: `role IN ('user', 'assistant', 'tool', 'system')`
- CHECK: `step_number >= 0`

**Indexes:**
- `idx_session_messages_session_id` on `session_id`
- `idx_session_messages_step` on `(session_id, step_number)`
- `idx_session_messages_role` on `(session_id, role)`

---

### agent_long_term_memory

Persistent knowledge for agents across sessions.

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
- CHECK: `memory_type IN ('fact', 'preference', 'learned', 'user_provided')`
- CHECK: `importance >= 1 AND importance <= 10`
- CHECK: `access_count >= 0`

**Indexes:**
- `idx_long_term_memory_agent_id` on `agent_id`
- `idx_long_term_memory_tenant_id` on `tenant_id`
- `idx_long_term_memory_type` on `(agent_id, memory_type)`
- `idx_long_term_memory_importance` on `(agent_id, importance DESC)`
- `idx_long_term_memory_active` on `(agent_id, is_active)`

---

### agent_tools

Tool registry for agent capabilities.

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
- CHECK: `tool_type IN ('mcp_server', 'python_script')`

**Indexes:**
- `idx_agent_tools_tenant_id` on `tenant_id`
- `idx_agent_tools_user_id` on `user_id`
- `idx_agent_tools_type` on `(tenant_id, tool_type)`
- `idx_agent_tools_active` on `(tenant_id, is_active)`

---

### agent_tool_assignments

Maps which tools each agent can use.

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

### mcp_servers

MCP server configurations for agent tools.

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
- CHECK: `auth_type IN ('none', 'api_key', 'bearer', 'basic')`
- CHECK: `health_status IN ('healthy', 'unhealthy', 'unknown')`

**Indexes:**
- `idx_mcp_servers_tenant_id` on `tenant_id`
- `idx_mcp_servers_tool_id` on `tool_id`
- `idx_mcp_servers_health` on `(tenant_id, health_status)`

**Notes:**
- `auth_config` stores encrypted credentials using AES-256
- Encryption key is stored in `NETLIFY_ENCRYPTION_KEY` environment variable

---

### agent_session_memory

Short-term working memory for agent sessions (execution plans, scratchpad).

| Column       | Type        | Nullable | Default           | Description                                |
|--------------|-------------|----------|-------------------|--------------------------------------------|
| memory_id    | UUID        | NO       | gen_random_uuid() | Primary key                                |
| session_id   | UUID        | NO       | -                 | Reference to agent_sessions                |
| memory_key   | TEXT        | NO       | -                 | Key identifier (execution_plan, scratchpad)|
| memory_value | JSONB       | NO       | -                 | Structured data for the memory entry       |
| created_at   | TIMESTAMPTZ | NO       | now()             | Record creation time                       |
| updated_at   | TIMESTAMPTZ | NO       | now()             | Last update time                           |

**Constraints:**
- PRIMARY KEY: `memory_id`
- FOREIGN KEY: `session_id` REFERENCES `agent_sessions(session_id)` ON DELETE CASCADE
- UNIQUE: `(session_id, memory_key)`

**Indexes:**
- `idx_session_memory_session_id` on `session_id`
- `idx_session_memory_session_key` on `(session_id, memory_key)`

**Triggers:**
- `update_agent_session_memory_updated_at` - Updates `updated_at` on row update

**Notes:**
- Used for storing execution plans during autonomous agent operation
- Memory is automatically deleted when the parent session is deleted
- Common memory_key values: `execution_plan`, `scratchpad`

---

## Notes

- All timestamps use `TIMESTAMPTZ` for timezone awareness
- UUIDs are generated server-side with `gen_random_uuid()`
- Passwords are hashed with bcrypt (12 rounds) before storage
- Cascade deletes: removing a user/tenant removes their memberships

---

*This file must be updated whenever schema changes are made.*
