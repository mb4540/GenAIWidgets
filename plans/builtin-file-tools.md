# Builtin File Tools Implementation Plan

Give agents the ability to interact with the File Storage system - list, read, create, and delete files within their tenant's storage.

---

## Overview

**Goal:** Enable agents to perform file operations on behalf of users, allowing them to:
- List files and folders in a directory
- Read/download file contents
- Create new text files
- Delete files

**Use Cases:**
- "Show me what files are in my /documents folder"
- "Create a new file called notes.txt with this content..."
- "Read the contents of config.json"
- "Delete the old report.pdf file"

---

## Tool Specifications

### Tool 1: list_files

```yaml
Tool Name: list_files
Display Name: List Files
Description: List files and folders in a directory. Returns file names, sizes, types, and folder contents.
Category: file

Parameters:
  - name: path
    type: string
    required: false
    default: "/"
    description: Directory path to list (e.g., "/" for root, "/documents" for documents folder)

Returns:
  - Success: Array of files and folders with names, sizes, types, and paths
  - Error: Path not found, permission denied

External APIs: None (internal database + blob storage)
```

### Tool 2: read_file

```yaml
Tool Name: read_file
Display Name: Read File
Description: Read the contents of a text file. Returns the file content as text. Only works with text-based files (txt, json, md, csv, etc.).
Category: file

Parameters:
  - name: file_path
    type: string
    required: true
    description: Full path to the file (e.g., "/documents/notes.txt")

Returns:
  - Success: File content as text string
  - Error: File not found, not a text file, file too large

External APIs: None (internal blob storage)
```

### Tool 3: create_file

```yaml
Tool Name: create_file
Display Name: Create File
Description: Create a new text file with the specified content. Overwrites if file already exists.
Category: file

Parameters:
  - name: file_path
    type: string
    required: true
    description: Full path for the new file (e.g., "/documents/notes.txt")
  
  - name: content
    type: string
    required: true
    description: Text content to write to the file

Returns:
  - Success: File ID and path of created file
  - Error: Invalid path, permission denied

External APIs: None (internal blob storage)
```

### Tool 4: delete_file

```yaml
Tool Name: delete_file
Display Name: Delete File
Description: Delete a file from storage. This action cannot be undone.
Category: file

Parameters:
  - name: file_path
    type: string
    required: true
    description: Full path to the file to delete (e.g., "/documents/old-report.pdf")

Returns:
  - Success: Confirmation of deletion
  - Error: File not found, permission denied

External APIs: None (internal database + blob storage)
```

---

## Implementation Tasks

### Phase 1: Create Tool Functions

- [ ] **1.1 Create `tool-files.ts`** - Single function handling all file operations
  - POST with `action: 'list'` - List files in directory
  - POST with `action: 'read'` - Read file contents
  - POST with `action: 'create'` - Create new file
  - POST with `action: 'delete'` - Delete file

- [ ] **1.2 Implement list_files action**
  - Query `files` and `folders` tables for given path
  - Return structured list with file metadata
  - Respect tenant isolation

- [ ] **1.3 Implement read_file action**
  - Look up file by path in `files` table
  - Fetch content from blob storage
  - Validate file is text-based (check mime_type)
  - Limit file size (e.g., 1MB max for reading)
  - Return content as string

- [ ] **1.4 Implement create_file action**
  - Parse path to extract folder and filename
  - Create folder if doesn't exist
  - Store content in blob storage
  - Insert record in `files` table
  - Return file_id and path

- [ ] **1.5 Implement delete_file action**
  - Look up file by path
  - Delete from blob storage
  - Delete from `files` table
  - Return confirmation

### Phase 2: Configuration

- [ ] **2.1 Add redirect in netlify.toml**
  ```toml
  [[redirects]]
    from = "/api/tools/files"
    to = "/.netlify/functions/tool-files"
    status = 200
  ```

- [ ] **2.2 Update agent-loop-background.ts**
  - Add `files` to builtin tool endpoint map
  - Ensure proper routing for file tool calls

- [ ] **2.3 Update agent-chat.ts**
  - Same updates for synchronous chat endpoint

### Phase 3: Seed Tools in Database

- [ ] **3.1 Create seed SQL script** `scripts/seed-file-tools.sql`
  - Insert 4 tool records (list_files, read_file, create_file, delete_file)
  - Set tool_type = 'builtin'
  - Define input_schema for each

- [ ] **3.2 Run seed script in production**

### Phase 4: Testing

- [ ] **4.1 Test locally with netlify dev**
  - Test each action independently
  - Test error cases (file not found, invalid path, etc.)

- [ ] **4.2 Test tool assignment to agent**
  - Assign file tools to an agent
  - Verify tools appear in agent's tool list

- [ ] **4.3 Test chat invocation**
  - Chat with agent and request file operations
  - Verify LLM correctly invokes tools
  - Verify results are returned properly

- [ ] **4.4 Deploy and verify in production**

---

## Seed SQL Script

```sql
-- List Files Tool
INSERT INTO agent_tools (
  tenant_id, user_id, name, description, tool_type, input_schema, is_active
) VALUES (
  NULL, NULL,
  'list_files',
  'List files and folders in a directory. Returns file names, sizes, types, and paths.',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Directory path to list (e.g., \"/\" for root, \"/documents\" for documents folder)",
        "default": "/"
      }
    },
    "required": []
  }',
  true
);

-- Read File Tool
INSERT INTO agent_tools (
  tenant_id, user_id, name, description, tool_type, input_schema, is_active
) VALUES (
  NULL, NULL,
  'read_file',
  'Read the contents of a text file. Only works with text-based files (txt, json, md, csv, xml, html).',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Full path to the file (e.g., \"/documents/notes.txt\")"
      }
    },
    "required": ["file_path"]
  }',
  true
);

-- Create File Tool
INSERT INTO agent_tools (
  tenant_id, user_id, name, description, tool_type, input_schema, is_active
) VALUES (
  NULL, NULL,
  'create_file',
  'Create a new text file with the specified content. Overwrites if file already exists.',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Full path for the new file (e.g., \"/documents/notes.txt\")"
      },
      "content": {
        "type": "string",
        "description": "Text content to write to the file"
      }
    },
    "required": ["file_path", "content"]
  }',
  true
);

-- Delete File Tool
INSERT INTO agent_tools (
  tenant_id, user_id, name, description, tool_type, input_schema, is_active
) VALUES (
  NULL, NULL,
  'delete_file',
  'Delete a file from storage. This action cannot be undone.',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Full path to the file to delete (e.g., \"/documents/old-report.pdf\")"
      }
    },
    "required": ["file_path"]
  }',
  true
);
```

---

## Security Considerations

- **Tenant Isolation**: All file operations must be scoped to the agent's tenant
- **Path Validation**: Sanitize paths to prevent directory traversal attacks
- **File Size Limits**: Limit read operations to reasonable file sizes (1MB)
- **Text Files Only**: read_file should only work on text-based mime types
- **Audit Logging**: Log all file operations for security review

---

## Notes

- The agent inherits the tenant context from the chat session
- File paths are relative to the tenant's root (/)
- Binary files can be listed but not read via read_file
- Consider adding a `search_files` tool in the future for finding files by name/content

