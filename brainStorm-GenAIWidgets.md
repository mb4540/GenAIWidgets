# Architectural Review Replica Tool

## 1. Idea Overview

### Concept
A tool that generates a simplified HTML replica of an application for conducting deep-dive architectural reviews with cross-functional teams.

### The Problem
When reviewing new features and functions with solution architects, front-end/back-end developers, and application designers, there's no easy way to:
- Walk through the UI component-by-component
- See the technical implementation details behind each component
- Capture structured feedback during the review session
- Generate actionable prompts for follow-up development work

### The Solution
Create an HTML replica of the real application that can be displayed side-by-side with the running application:

| Left Side (Real App)   | Right Side (Replica)        |
|------------------------|-----------------------------|
| Live, functional UI    | Static HTML representation  |
| Interactive components | Same visual layout          |
| Production behavior    | Technical annotations       |

### Replica Features

**For Each Component, Display:**
- **Visual Representation**: Simplified HTML/CSS matching the real component
- **Technical References**:
  - Functions/methods that power the component
  - APIs called (endpoints, methods, payloads)
  - Database impact:
    - PostgreSQL (Neon): Tables and fields affected
  - State management details
  - Key dependencies

**Review Capture:**
Each component includes a notes section with options to:
1. ✅ **Accept** - Component approved as-is
2. 🔄 **Change Request** - Modifications needed to existing functionality
3. ✨ **Enhancement** - New capabilities to add

### Output
Notes collected during the review session are exported to a markdown file formatted as a prompt for Windsurf to execute the requested changes in a follow-up agentic coding session.

### Target Users
- Solution Architects
- Front-end Developers
- Back-end Developers
- Application Designers
- Technical Leads

---

## 2. Workspace Profile

*Customized for the GenAIWidgets repository.*

| Property                | Value                                                    |
|-------------------------|----------------------------------------------------------|
| Project Name            | GenAIWidgets                                             |
| Workspace Type          | Single repo                                              |
| Frontend Framework      | React 19 with TypeScript (.tsx)                          |
| Backend                 | Netlify Functions (serverless)                           |
| Database                | PostgreSQL via Neon (@neondatabase/serverless)           |
| File Storage            | Netlify Blobs                                            |
| Styling                 | Tailwind CSS 4                                           |
| State Management        | React Context (AuthContext)                              |
| API Pattern             | REST (Netlify Functions endpoints)                       |
| Routing                 | React Router DOM v7                                      |
| Authentication          | JWT with bcrypt password hashing                         |
| AI Integrations         | OpenAI, Anthropic Claude                                 |
| Testing                 | Vitest + React Testing Library                           |

### Key Directories

| Directory              | Purpose                                                  |
|------------------------|----------------------------------------------------------|
| `src/pages/`           | Route page components (HomePage, auth/, dashboard/, etc.)|
| `src/components/`      | Reusable UI components (auth/, common/, layout/, files/) |
| `src/contexts/`        | React contexts (AuthContext)                             |
| `src/hooks/`           | Custom React hooks                                       |
| `src/lib/`             | Utility libraries (auth-client, etc.)                    |
| `src/types/`           | Shared TypeScript type definitions                       |
| `netlify/functions/`   | Serverless API endpoints                                 |
| `migrations/`          | Database migration SQL files                             |

### Application Routes

| Route                  | Component                    | Auth Required |
|------------------------|------------------------------|---------------|
| `/`                    | HomePage                     | No            |
| `/auth/login`          | LoginPage                    | No            |
| `/auth/signup`         | SignupPage                   | No            |
| `/dashboard`           | DashboardPage                | Yes           |
| `/ai-gateway-chat`     | AiGatewayChatPage            | Yes           |
| `/files`               | FilesPage                    | Yes           |
| `/rag-preprocessing`   | RagPreprocessingPage         | Yes           |
| `/admin`               | AdminPage                    | Yes           |

### API Endpoints (Netlify Functions)

| Endpoint                        | Purpose                                    |
|---------------------------------|--------------------------------------------|
| `auth-signin`                   | User authentication                        |
| `auth-signup`                   | User registration                          |
| `auth-me`                       | Get current user session                   |
| `dashboard-stats`               | Dashboard statistics                       |
| `files-list`, `files-upload`    | File management                            |
| `files-download`, `files-delete`| File operations                            |
| `folders-create`, `folders-delete`| Folder management                        |
| `admin-users`, `admin-tenants`  | Admin user/tenant management               |
| `admin-memberships`, `admin-prompts`| Admin membership/prompt management     |
| `ai-chat`                       | AI chat gateway                            |
| `extraction-*`                  | Document extraction pipeline               |
| `qa-*`                          | Q&A generation and management              |
| `tenants-list`                  | List available tenants                     |

### Database Tables

Reference: `db_ref.md`

| Table         | Purpose                                    |
|---------------|--------------------------------------------|
| `users`       | User accounts                              |
| `tenants`     | Multi-tenant organizations                 |
| `memberships` | User-tenant relationships with roles       |
| `admins`      | System-wide administrator access           |
| `folders`     | Virtual directory structure                |
| `files`       | File metadata (blobs stored in Netlify)    |

### Suggested Exclude Patterns

- `src/components/ui/*` - UI component library (if using shadcn)
- `**/*.test.tsx` - Test files (unless reviewing tests)
- `**/*.test.ts` - Test files
- `dist/*` - Build output
- `node_modules/*` - Dependencies
- `coverage/*` - Test coverage reports
- `_cleanup_backup_*/*` - Backup directories

---

## 3. Scope Configuration

When reviewing a feature branch or partial changes, define the review scope using one of these strategies:

### Scope Modes

| Mode       | Description                              | Use When                          |
|------------|------------------------------------------|-----------------------------------|
| `full`     | Review entire application                | New project or major refactor     |
| `git-diff` | Auto-detect changed files vs base branch | Feature branch review             |
| `paths`    | Explicitly list files/directories        | Targeted review of specific areas |
| `routes`   | Define by user-facing routes/screens     | UX-focused review                 |

### Configuration Template

Add this block to your prompt when invoking the tool:

```markdown
**Review Scope:**
- Mode: [full | git-diff | paths | routes]
- Base Branch: main (for git-diff mode)
- Include Paths: (for paths mode)
  - src/pages/rag/
  - src/components/files/
  - netlify/functions/extraction-*.ts
- Include Routes: (for routes mode)
  - /dashboard
  - /files
  - /rag-preprocessing
- Exclude Patterns:
  - src/components/ui/*
  - **/*.test.tsx
  - **/*.test.ts
- Include Context Dependencies: true/false
  (When true, shows unchanged code that modified code depends on, marked as "context-only")
```

### Visual Indicators in Replica

The generated replica will mark components with scope status:

| Badge            | Meaning                                          |
|------------------|--------------------------------------------------|
| 🆕 **NEW**       | File/component added in this branch              |
| ✏️ **MODIFIED**  | Existing file/component was changed              |
| 📎 **CONTEXT**   | Unchanged, but included for dependency context   |
| ⚪ **UNCHANGED** | Only shown in `full` mode                        |

### Scope Summary

The replica header will include a scope summary:
- Total components in scope
- Breakdown by status (new/modified/context)
- Files excluded and why
- Base branch comparison (for git-diff mode)

---

## 4. System Prompt

```
You are an architectural documentation assistant. Your task is to analyze this codebase and generate an HTML replica page for conducting architectural reviews.

**Instructions:**

0. **Determine Review Scope** based on the provided scope configuration:
   - If `git-diff` mode: Run `git diff --name-only <base-branch>...HEAD` to identify changed files
   - If `paths` mode: Use the explicitly provided file/directory list
   - If `routes` mode: Trace components rendered by the specified routes
   - If `full` mode: Include all application components
   - When "Include Context Dependencies" is true, also include unchanged files that are imported/called by in-scope files (mark these as context-only)

1. **Identify the main UI components** in the application by examining:
   - React components (.tsx files in src/pages/ and src/components/)
   - Page layouts and routes (defined in src/App.tsx)
   - Reusable UI elements

2. **For each component, document:**
   - Component name and file location
   - Props/inputs it accepts
   - Functions/methods it uses (with file references)
   - API calls it makes (Netlify Functions endpoint, method, request/response shape)
   - Database operations:
     - PostgreSQL (Neon): Tables and columns read/written (reference db_ref.md)
   - State it manages or consumes (React Context, local state)

3. **Generate a single HTML file** (`review-replica.html`) that:
   - Visually represents each component in a simplified form
   - Uses inline CSS for styling (no external dependencies)
   - Displays technical annotations next to each component
   - Includes a collapsible notes section for each component with:
     - Radio buttons: Accept / Change Request / Enhancement
     - Text area for detailed notes
   - Has a "Export Notes" button that generates markdown output

4. **Structure the HTML with:**
   - A header showing:
     - Application name (GenAIWidgets) and review date
     - **Scope summary**: mode used, base branch (if git-diff), component counts by status
     - Filter toggles to show/hide components by scope status
   - A sidebar listing all components for navigation, with scope badges (🆕/✏️/📎)
   - A main content area with component cards
   - Each card contains:
     - **Scope badge** indicating NEW/MODIFIED/CONTEXT status
     - Component visual representation
     - Technical details (collapsible)
     - Review notes section (disabled for CONTEXT-only components by default)

5. **The exported markdown should be formatted as:**
   ```markdown
   # Architectural Review Notes - GenAIWidgets
   **Review Date:** [Date]
   **Scope:** [Mode] | Base: [branch] | Components: [X new, Y modified, Z context]
   
   ## Component: [Name] [🆕|✏️|📎]
   **Scope Status:** [NEW/MODIFIED/CONTEXT]
   **Review Status:** [Accept/Change Request/Enhancement]
   **Notes:**
   [Captured notes]
   
   **Technical Context:**
   - File: [path]
   - APIs: [Netlify Functions called]
   - Database: [PostgreSQL tables affected]
   
   ---
   ```

6. **Make the replica self-contained** - single HTML file with no external dependencies that can be opened directly in a browser.

**Output:** Create the file `review-replica.html` in the project root.
```

---

## 5. Testing Notes

*Testing of this concept in the GenAIWidgets repo.*

- [x] Generate replica for current application
- [ ] Test side-by-side viewing
- [ ] Validate technical references accuracy
- [ ] Test notes capture workflow
- [ ] Test markdown export
- [ ] Refine prompt based on results

---

## 6. Refinement Log

*Track iterations and improvements to the concept and prompt here.*

| Date       | Change                                   | Reason                                    |
|------------|------------------------------------------|-------------------------------------------|
| 2026-01-16 | Created customized version for GenAIWidgets | Initial workspace analysis and customization |
| 2026-01-16 | Generated review-replica.html (full scope) | 11 components documented with visual mocks, technical details, and review notes |
