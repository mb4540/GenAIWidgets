---
trigger: model_decision
---
# Application Review Rules

Standards for generating architectural review replicas for cross-functional team reviews.

---

## Overview

Generate HTML replicas of applications for conducting deep-dive architectural reviews with solution architects, developers, and designers.

### Purpose

- Walk through UI component-by-component
- Display technical implementation details behind each component
- Capture structured feedback during review sessions
- Generate actionable prompts for follow-up development work

### Review Format

| Left Side (Real App)   | Right Side (Replica)        |
|------------------------|-----------------------------|
| Live, functional UI    | Static HTML representation  |
| Interactive components | Same visual layout          |
| Production behavior    | Technical annotations       |

---

## Scope Configuration

### Scope Modes

| Mode       | Description                              | Use When                          |
|------------|------------------------------------------|-----------------------------------|
| `full`     | Review entire application                | New project or major refactor     |
| `git-diff` | Auto-detect changed files vs base branch | Feature branch review             |
| `paths`    | Explicitly list files/directories        | Targeted review of specific areas |
| `routes`   | Define by user-facing routes/screens     | UX-focused review                 |

### Visual Indicators

| Badge            | Meaning                                          |
|------------------|--------------------------------------------------|
| 🆕 **NEW**       | File/component added in this branch              |
| ✏️ **MODIFIED**  | Existing file/component was changed              |
| 📎 **CONTEXT**   | Unchanged, but included for dependency context   |
| ⚪ **UNCHANGED** | Only shown in `full` mode                        |

### Scope Configuration Template

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
```

---

## Component Documentation

### Required Information Per Component

For each component in the replica, document:

- **Component name and file location**
- **Props/inputs** it accepts
- **Functions/methods** it uses (with file references)
- **API calls** it makes:
  - Endpoint URL
  - HTTP method
  - Request/response shape
- **Database operations**:
  - Tables and columns read/written
  - Query types (SELECT, INSERT, UPDATE, DELETE)
- **State management**:
  - Local state
  - Context consumption
  - Global state access

---

## Output Structure

### Single-File Output (Small Applications)

For applications with fewer than 10 components, generate a single `review-replica.html`:

```
project-root/
└── review-replica.html    # Self-contained HTML file
```

### Multi-File Output (Large Applications)

For larger applications, generate a directory structure:

```
review-replica/
├── index.html              # Main entry point with navigation
├── styles/
│   └── main.css            # Shared styles
├── scripts/
│   ├── navigation.js       # Sidebar navigation logic
│   ├── notes.js            # Notes capture and local storage
│   └── export.js           # Markdown export functionality
├── pages/
│   ├── dashboard.html      # One HTML file per major route/page
│   ├── files.html
│   └── admin.html
├── components/
│   ├── _template.html      # Template for component cards
│   ├── header.html         # Shared header
│   └── sidebar.html        # Shared sidebar navigation
└── data/
    └── components.json     # Component metadata
```

---

## HTML Structure Requirements

### Page Layout

Each page must include:

1. **Header**:
   - Application name and review date
   - Scope summary (mode, base branch, component counts)
   - Filter toggles for scope status

2. **Sidebar**:
   - Component list with navigation links
   - Scope badges (🆕/✏️/📎/⚪)

3. **Main Content**:
   - Component cards with:
     - Scope badge
     - Visual representation (simplified HTML/CSS)
     - Technical details (collapsible)
     - Review notes section

### Component Card Structure

```html
<div class="component-card" data-scope="[new|modified|context|unchanged]">
  <div class="card-header">
    <h2>ComponentName</h2>
    <span class="scope-badge">[Badge]</span>
  </div>
  <div class="visual-rep">
    <!-- Simplified visual mock -->
  </div>
  <div class="tech-details">
    <!-- Collapsible technical information -->
  </div>
  <div class="review-notes">
    <!-- Radio: Accept / Change Request / Enhancement -->
    <!-- Textarea for notes -->
  </div>
</div>
```

---

## Review Notes Capture

### Review Status Options

Each component includes a notes section with:

1. ✅ **Accept** - Component approved as-is
2. 🔄 **Change Request** - Modifications needed
3. ✨ **Enhancement** - New capabilities to add

### Notes Persistence

- Store notes in browser localStorage
- Sync across pages in multi-file replicas
- Preserve notes on page refresh

---

## Markdown Export Format

The "Export Notes" button generates markdown formatted as:

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

---

## Self-Contained Requirements

The replica must be:

- **No external dependencies** - All CSS/JS inline or local
- **File protocol compatible** - Opens via `file://` URL
- **No build step required** - Static HTML only
- **Portable** - Can be shared as a zip file

---

## Workspace Customization

### File Naming Convention

When creating review replicas for specific repositories:

1. **Template file**: Keep as reusable master
2. **Customized copies**: `[template]-{RepoName}.md`
   - Example: `arch-review-GenAIWidgets.md`

### Workspace Analysis

Before generating, analyze:

- Frontend framework (React, Vue, Angular, etc.)
- Backend type (Netlify Functions, Express, etc.)
- Database (PostgreSQL, MongoDB, etc.)
- Styling approach (Tailwind, CSS Modules, etc.)
- State management (Context, Redux, Zustand, etc.)
- API patterns (REST, GraphQL, tRPC, etc.)

### Suggested Exclude Patterns

Common exclusions:

- `src/components/ui/*` - UI component libraries
- `**/*.test.tsx` - Test files
- `dist/*` - Build output
- `node_modules/*` - Dependencies

---

## Generation Checklist

Before generating a review replica:

- [ ] Determine scope mode (full/git-diff/paths/routes)
- [ ] Identify all in-scope components
- [ ] Gather technical details for each component
- [ ] Create visual mocks matching actual UI
- [ ] Include collapsible technical sections
- [ ] Add review notes with radio buttons
- [ ] Implement export functionality
- [ ] Test in browser

---

*Review replicas enable structured architectural discussions and generate actionable development prompts.*
