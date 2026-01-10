# Usage Guide

How to use this scaffolding repository to create new projects.

---

## Overview

This repository is a **template** containing planning documentation and development rules. It does not contain application code—it provides the blueprint and standards for building applications consistently.

---

## Two Ways to Use This Repo

### Option A: Copy Files to Existing Project

Use this when you already have a project started or want to add scaffolding standards to an existing repo.

1. **Copy the `.windsurf/` directory** to your project root
2. **Copy `db_ref.md`** to your project root
3. **Reference `goldScaffoldingPlan.md`** for setup steps (keep it open as a guide)

### Option B: Clone as New Project Base (Recommended)

Use this when starting a brand new project from scratch.

Follow the steps below.

---

## Starting a New Project (Step-by-Step)

### Step 1: Create Your New Repository

```bash
# Create a new directory for your project
mkdir my-new-project
cd my-new-project

# Initialize git
git init
```

### Step 2: Copy Scaffolding Files

Copy these files/directories from ProjectScaffolding to your new project:

```bash
# Copy the rules directory
cp -r /path/to/ProjectScaffolding/.windsurf ./

# Copy the database reference template
cp /path/to/ProjectScaffolding/db_ref.md ./

# Copy the scaffolding plan for reference
cp /path/to/ProjectScaffolding/goldScaffoldingPlan.md ./
```

### Step 3: Follow the Scaffolding Plan

Open `goldScaffoldingPlan.md` and execute each phase in order:

1. **Phase 1: Project Initialization** — Create Vite project, install dependencies
2. **Phase 2: Directory Structure** — Set up folders as specified
3. **Phase 3: Configuration Files** — Create config files (copy from plan)
4. **Phase 4: Environment Variables** — Set up `.env.example` and `.env.local`
5. **Phase 5: Database Setup** — Create Neon project and run migrations
6. **Phase 6: Authentication** — Implement auth endpoints and frontend
7. **Phase 7: Netlify Deployment** — Connect and deploy
8. **Phase 8: Verification** — Run through the checklist

### Step 4: Customize for Your Project

After completing the scaffolding:

1. **Update `package.json`** with your project name and description
2. **Update `db_ref.md`** with your actual schema after running migrations
3. **Update `README.md`** with project-specific documentation
4. **Remove `goldScaffoldingPlan.md`** once setup is complete (optional)

### Step 5: Connect to Remote Repository

```bash
# Add your remote origin
git remote add origin https://github.com/your-org/my-new-project.git

# Initial commit
git add .
git commit -m "Initial project setup from scaffolding"
git push -u origin main
```

---

## What Each File Does

| File/Directory            | Purpose                                      | Keep in New Project? |
|---------------------------|----------------------------------------------|----------------------|
| `.windsurf/`              | Development rules and standards              | **Yes** (required)   |
| `db_ref.md`               | Database schema documentation                | **Yes** (required)   |
| `goldScaffoldingPlan.md`  | Setup instructions                           | Optional (reference) |
| `README.md`               | Repository documentation                     | Replace with yours   |
| `USAGE_GUIDE.md`          | This file                                    | No (delete)          |

---

## Working with the Rules

### During Development

The `.windsurf/` rules are automatically picked up by Windsurf/Cascade IDE. They guide AI assistance to follow your project standards.

**Key rules to know:**

- **`security.md`** — Never commit secrets, use parameterized SQL
- **`code-quality.md`** — TypeScript strict mode, no `any` types
- **`database-design.md`** — Always update `db_ref.md` when changing schema
- **`cleanup.md`** — Use soft deletions, create backup before refactoring

### During Code Review

Reference the rules when reviewing PRs:

- Does the code follow `code-quality.md` naming conventions?
- Are database changes reflected in `db_ref.md`?
- Does the API follow `api-design.md` response structure?

---

## Updating the Database Reference

**Critical:** `db_ref.md` must stay in sync with your actual database.

### When to Update

- After running any migration
- After adding/removing tables or columns
- After adding/removing indexes
- Periodically update row counts

### How to Update

1. Run your migration
2. Open `db_ref.md`
3. Add/update the table definition
4. Update the Migration History table
5. Commit both the migration and `db_ref.md` together

---

## Environment Setup Checklist

Before your new project is ready for development:

- [ ] Neon project created with `main` and `dev` branches
- [ ] `DATABASE_URL` set in `.env.local` (dev branch)
- [ ] `JWT_SECRET` generated and set in `.env.local`
- [ ] Netlify site created and linked
- [ ] Environment variables set in Netlify dashboard
- [ ] Initial migration run on database
- [ ] `db_ref.md` updated with actual schema

---

## Common Questions

### Do I need to keep goldScaffoldingPlan.md?

No. Once your project is set up, you can delete it. The `.windsurf/` rules are what matter for ongoing development.

### Can I modify the rules?

Yes, but consider whether changes should apply to all projects. If so, update the original ProjectScaffolding repo. If project-specific, document the deviation.

### What if I need a different stack?

The rules are somewhat stack-agnostic (TypeScript, testing, security principles apply broadly). Modify as needed, but maintain the spirit of the standards.

### How do I update my project when ProjectScaffolding changes?

Manually review changes to ProjectScaffolding and apply relevant updates to your `.windsurf/` rules. There's no automatic sync.

---

## Quick Reference

### New Project Commands

```bash
# 1. Create Vite project
npm create vite@latest my-project -- --template react-ts
cd my-project

# 2. Install dependencies (from goldScaffoldingPlan.md Phase 1)
npm install react-router-dom @netlify/functions @neondatabase/serverless
npm install jsonwebtoken bcryptjs
npm install -D tailwindcss postcss autoprefixer
# ... (see full list in goldScaffoldingPlan.md)

# 3. Initialize Tailwind
npx tailwindcss init -p

# 4. Initialize shadcn/ui
npx shadcn@latest init

# 5. Run dev server
npm run dev
```

### Useful Netlify Commands

```bash
# Local development with functions
netlify dev

# Deploy preview
netlify deploy

# Deploy to production
netlify deploy --prod
```

### Database Commands

```bash
# Connect to database
psql $DATABASE_URL

# Run migration
psql $DATABASE_URL -f migrations/001_initial_schema.sql
```

---

## Support

If you encounter issues with the scaffolding process:

1. Check `goldScaffoldingPlan.md` for detailed instructions
2. Review the relevant `.windsurf/` rule file
3. Consult the technology-specific documentation (Vite, Netlify, Neon)

---

*This guide helps you get started. The real value is in the rules and standards that keep your project consistent over time.*
