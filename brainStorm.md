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
    - PostgreSQL: Tables and fields affected
    - MongoDB: Collections and documents affected
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

## 2. Workspace Customization (Agent Instructions)

**Purpose:** Before using this tool, an agentic IDE assistant should analyze the workspace and customize this file for the specific project.

### File Naming Convention

**IMPORTANT:** The original `brainStorm.md` file should remain unchanged as a reusable template. When customizing for a specific repository:

1. **Create a copy** with the naming pattern: `brainStorm-{RepoName}.md`
   - Example: `brainStorm-GenAIWidgets.md`
   - Example: `brainStorm-CustomerPortal.md`
   - For multi-root workspaces: `brainStorm-{WorkspaceName}.md`

2. **Keep the original** `brainStorm.md` as the master template
   - Do not modify the placeholder values in the original
   - The original can be copied to new repos or used to create new customized versions

3. **For feature branch reviews**, you may optionally create branch-specific versions:
   - Pattern: `brainStorm-{RepoName}-{BranchName}.md`
   - Example: `brainStorm-GenAIWidgets-feature-auth-refactor.md`

### Agent Prompt: Customize brainStorm.md

```
You are a workspace analysis assistant. Your task is to review the brainStorm.md template and create a customized copy for the current workspace.

**Instructions:**

0. **Create the Customized File**
   - Copy brainStorm.md to brainStorm-{RepoName}.md
   - All subsequent modifications go in the new file, NOT the original template

1. **Analyze the Workspace Structure**
   - Identify if this is a single repo or multi-root workspace
   - For multi-root: List each root and its purpose
   - Detect the primary framework(s): React, Vue, Angular, Svelte, etc.
   - Identify the backend: Netlify Functions, Express, Next.js API routes, etc.
   - Detect database(s): PostgreSQL, MongoDB, Supabase, Firebase, etc.
   - Note the styling approach: Tailwind, CSS Modules, styled-components, etc.

2. **Update the Database Impact Section**
   Remove or modify database references that don't apply:
   - If only PostgreSQL: Remove MongoDB references
   - If only MongoDB: Remove PostgreSQL references
   - If using Supabase/Firebase: Update terminology accordingly
   - If no database: Remove database sections entirely

3. **Update the Framework References**
   In the System Prompt section, replace generic framework mentions with specific ones:
   - Replace "React/Vue/Angular components" with the actual framework used
   - Update file extension references (.tsx, .vue, .svelte, etc.)
   - Adjust state management references (Redux, Zustand, Pinia, etc.)

4. **Configure for Multi-Root Workspaces**
   If this is a multi-root workspace:
   - Add a "Workspace Roots" subsection listing each root
   - Update scope configuration to support per-root or cross-root reviews
   - Add root selection to the Configuration Template

5. **Pre-populate Exclude Patterns**
   Based on the workspace, suggest common exclusions:
   - UI component libraries (shadcn, Radix, etc.)
   - Generated files (Prisma client, GraphQL types, etc.)
   - Test files if not reviewing tests
   - Build output directories

6. **Add Project-Specific Context**
   Create a new "Workspace Profile" section containing:
   - Project name
   - Tech stack summary
   - Key directories and their purposes
   - API patterns used (REST, GraphQL, tRPC, etc.)
   - Authentication approach if detected

7. **Output**
   Save the customized version as brainStorm-{RepoName}.md (do NOT modify the original template).
   Add a row to the Refinement Log in the new file documenting the customization.
```

### Workspace Profile

*This section will be populated by the agent after workspace analysis.*

| Property                | Value                                      |
|-------------------------|--------------------------------------------|
| Project Name            | *[To be detected]*                         |
| Workspace Type          | *[Single repo / Multi-root]*               |
| Frontend Framework      | *[React / Vue / Angular / Svelte / etc.]*  |
| Backend                 | *[Netlify Functions / Express / etc.]*     |
| Database                | *[PostgreSQL / MongoDB / None / etc.]*     |
| Styling                 | *[Tailwind / CSS Modules / etc.]*          |
| State Management        | *[Context / Redux / Zustand / etc.]*       |
| API Pattern             | *[REST / GraphQL / tRPC / etc.]*           |

### Workspace Roots (Multi-Root Only)

*For multi-root workspaces, list each root directory and its role.*

| Root Path              | Purpose                                    | Include in Review     |
|------------------------|--------------------------------------------|-----------------------|
| *[e.g., /frontend]*    | *[React SPA]*                              | *[Yes / No]*          |
| *[e.g., /api]*         | *[Express backend]*                        | *[Yes / No]*          |
| *[e.g., /shared]*      | *[Shared types and utilities]*             | *[Context only]*      |

### Suggested Exclude Patterns

*Pre-populated based on workspace analysis.*

- *[To be detected based on project structure]*

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
  - src/pages/NewFeature/
  - src/components/ModifiedWidget.tsx
- Include Routes: (for routes mode)
  - /dashboard
  - /reports/*
- Exclude Patterns:
  - src/components/ui/* (third-party/generated)
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
   - React/Vue/Angular components
   - Page layouts and routes
   - Reusable UI elements

2. **For each component, document:**
   - Component name and file location
   - Props/inputs it accepts
   - Functions/methods it uses (with file references)
   - API calls it makes (endpoint, method, request/response shape)
   - Database operations:
     - For SQL: Tables and columns read/written
     - For MongoDB: Collections and document structures affected
   - State it manages or consumes

3. **Generate a multi-file HTML site** in a `review-replica/` directory that:
   - Enables replication of large, complex applications without hitting file size limits
   - Uses a modular structure with separate files for maintainability
   - Can be opened directly in a browser (no build step required)
   - Supports incremental generation (add pages as needed)

4. **Directory Structure:**
   ```
   review-replica/
   ├── index.html              # Main entry point with navigation
   ├── styles/
   │   └── main.css            # Shared styles (extracted from inline)
   ├── scripts/
   │   ├── navigation.js       # Sidebar navigation logic
   │   ├── notes.js            # Notes capture and local storage
   │   └── export.js           # Markdown export functionality
   ├── pages/
   │   ├── dashboard.html      # One HTML file per major route/page
   │   ├── files.html
   │   ├── rag-preprocessing.html
   │   └── admin.html
   ├── components/
   │   ├── _template.html      # Template for component cards
   │   ├── header.html         # Shared header (included via JS)
   │   └── sidebar.html        # Shared sidebar navigation
   └── data/
       └── components.json     # Component metadata for dynamic rendering
   ```

5. **Structure each page HTML with:**
   - A header showing:
     - Application name and review date
     - **Scope summary**: mode used, base branch (if git-diff), component counts by status
     - Filter toggles to show/hide components by scope status
   - A sidebar listing all components for navigation, with scope badges (🆕/✏️/📎)
   - A main content area with component cards
   - Each card contains:
     - **Scope badge** indicating NEW/MODIFIED/CONTEXT status
     - Component visual representation
     - Technical details (collapsible)
     - Review notes section (disabled for CONTEXT-only components by default)
   - Notes are persisted to localStorage and synced across pages

6. **The exported markdown should be formatted as:**
   ```markdown
   # Architectural Review Notes - [App Name]
   **Review Date:** [Date]
   **Scope:** [Mode] | Base: [branch] | Components: [X new, Y modified, Z context]
   
   ## Component: [Name] [🆕|✏️|📎]
   **Scope Status:** [NEW/MODIFIED/CONTEXT]
   **Review Status:** [Accept/Change Request/Enhancement]
   **Notes:**
   [Captured notes]
   
   **Technical Context:**
   - File: [path]
   - APIs: [list]
   - Database: [tables/collections]
   
   ---
   ```

7. **Make the replica self-contained:**
   - All CSS/JS is local (no CDN dependencies)
   - Can be opened directly via `file://` protocol or served with any static server
   - Notes persist in browser localStorage
   - Export generates a downloadable markdown file

8. **Generation Strategy for Large Applications:**
   - Generate `index.html` and shared assets first
   - Generate one page file per major route/feature area
   - If a single page would exceed ~500 lines, split into sub-pages
   - Use `components.json` to track all components and their locations
   - This allows incremental generation without regenerating the entire site

**Output:** Create the `review-replica/` directory with the multi-file structure described above.
```

---

## 5. Testing Notes

*This section will be used to track testing of this concept in the GenAIWidgets repo.*

- [ ] Generate replica for current application
- [ ] Test side-by-side viewing
- [ ] Validate technical references accuracy
- [ ] Test notes capture workflow
- [ ] Test markdown export
- [ ] Refine prompt based on results

---

## 6. Refinement Log

*Track iterations and improvements to the concept and prompt here.*

| Date       | Change                                   | Reason                            |
|------------|------------------------------------------|-----------------------------------|
|            |                                          |                                   |
