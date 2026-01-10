# ProjectScaffolding

A reusable template repository containing rules, standards, and planning documentation for scaffolding new full-stack applications.

---

## Purpose

This repository serves as a **starting point for new projects**. It provides:

- **Scaffolding Plan** — Step-by-step guide for setting up a new application
- **Development Rules** — Enforceable standards for code quality, security, testing, and more
- **Database Reference Template** — Single source of truth for schema documentation

Clone or copy this repository when starting a new project to ensure consistent architecture and best practices.

---

## Target Stack

| Layer           | Technology                |
|-----------------|---------------------------|
| Frontend        | React + Vite (TypeScript) |
| Styling         | Tailwind CSS              |
| UI Components   | shadcn/ui                 |
| Routing         | react-router-dom          |
| Hosting         | Netlify                   |
| Backend         | Netlify Functions         |
| Database        | Neon (PostgreSQL)         |
| Authentication  | JWT + bcryptjs            |

---

## Repository Contents

```
ProjectScaffolding/
├── .windsurf/                    # Development rules and standards
│   ├── security.md               # Security guidelines
│   ├── code-quality.md           # TypeScript and coding standards
│   ├── testing.md                # Testing requirements
│   ├── database-design.md        # Schema design rules
│   ├── neon-database.md          # Neon-specific guidelines
│   ├── api-design.md             # API design standards
│   ├── cleanup.md                # Safe refactoring rules
│   ├── frontend-components.md    # React component standards
│   └── ai-gateway.md             # AI Gateway usage rules
│
├── goldScaffoldingPlan.md        # Complete scaffolding guide
├── db_ref.md                     # Database schema reference template
└── README.md                     # This file
```

---

## Quick Start

### For New Projects

1. **Clone this repository** as your starting point
2. **Rename** the project directory and update `package.json`
3. **Follow** `goldScaffoldingPlan.md` step-by-step
4. **Reference** `.windsurf/` rules during development

### Key Files

| File                      | Purpose                                              |
|---------------------------|------------------------------------------------------|
| `goldScaffoldingPlan.md`  | Complete setup guide with commands and configuration |
| `db_ref.md`               | Template for documenting your database schema        |
| `.windsurf/*.md`          | Development standards to follow throughout project   |

---

## Rules Overview

| Rule File                | Covers                                                |
|--------------------------|-------------------------------------------------------|
| `security.md`            | Secrets, auth, logging prohibitions, OWASP practices  |
| `code-quality.md`        | TypeScript strictness, naming, file organization      |
| `testing.md`             | Unit/integration tests, coverage, CI guidelines       |
| `database-design.md`     | Schema standards, migrations, `db_ref.md` requirement |
| `neon-database.md`       | Serverless connections, branching, pooling            |
| `api-design.md`          | REST conventions, error handling, response structure  |
| `cleanup.md`             | Safe refactoring with soft deletions and backups      |
| `frontend-components.md` | React/Tailwind/shadcn/ui component patterns           |
| `ai-gateway.md`          | Netlify AI Gateway integration and rate limiting      |

---

## Usage Guidelines

- **Do not modify** rule files for project-specific exceptions without team review
- **Always update** `db_ref.md` when making schema changes
- **Follow** the scaffolding plan in order for consistent setup
- **Reference** rules during code review to maintain standards

---

## Contributing

When updating this scaffold:

1. Changes should be **broadly reusable** across projects
2. Keep **app-specific logic** out of the scaffold
3. Update relevant documentation when adding features
4. Tag stable versions for easy reference

---

## License

Internal use only. Adapt as needed for your organization.