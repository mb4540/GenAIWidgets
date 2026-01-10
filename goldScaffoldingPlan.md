# Gold Scaffolding Plan

A comprehensive, production-ready guide for scaffolding new applications using the standard stack.

---

## Table of Contents

1. [Operating Mode](#operating-mode)
2. [Guiding Principles](#guiding-principles)
3. [Stack Overview](#stack-overview)
4. [Prerequisites](#prerequisites)
5. [Phase 1: Project Initialization](#phase-1-project-initialization)
6. [Phase 2: Directory Structure](#phase-2-directory-structure)
7. [Phase 3: Configuration Files](#phase-3-configuration-files)
8. [Phase 4: Environment Variables](#phase-4-environment-variables)
9. [Phase 5: Database Setup](#phase-5-database-setup)
10. [Phase 6: Authentication Implementation](#phase-6-authentication-implementation)
11. [Phase 7: Netlify Deployment](#phase-7-netlify-deployment)
12. [Phase 8: Post-Setup Verification](#phase-8-post-setup-verification)
13. [Reusability Guidance](#reusability-guidance)
14. [Tooling Justification](#tooling-justification)
15. [Rules Reference](#rules-reference)

---

## Operating Mode

This document is **planning and reference documentation**.

- Intended for **human review and manual execution**
- Do not automate steps without understanding each one
- Repository name assumed: `ProjectScaffolding` (update for your project)

---

## Guiding Principles

| Principle                  | Description                                                              |
|----------------------------|--------------------------------------------------------------------------|
| **Safety First**           | Secure defaults, least privilege, no credential leakage                  |
| **Repeatability**          | Predictable structure, explicit environment strategy, minimal hidden magic |
| **Separation of Concerns** | Clear boundaries between UI, domain logic, data, and API layers          |
| **Serverless-First**       | Design API and DB access for short-lived runtimes                        |
| **Production Parity**      | Local development mimics Netlify contexts and Neon branches              |
| **Type Safety**            | TypeScript strict mode everywhere, no `any` types                        |

---

## Stack Overview

| Layer               | Technology                 | Purpose                              | Justification                                         |
|---------------------|----------------------------|--------------------------------------|-------------------------------------------------------|
| **Frontend**        | React + Vite (TypeScript)  | Modern, fast SPA development         | Fast HMR, native ESM, excellent TS support            |
| **Styling**         | Tailwind CSS               | Utility-first CSS framework          | Rapid styling, consistent design system, small bundle |
| **UI Components**   | shadcn/ui                  | Accessible, customizable components  | Copy-paste ownership, accessible by default           |
| **Routing**         | react-router-dom           | Client-side routing                  | Industry standard, flexible, well-documented          |
| **Hosting**         | Netlify                    | Static hosting with edge capabilities| Simple deploys, serverless functions, edge network    |
| **Backend**         | Netlify Functions          | Serverless API endpoints             | Zero-config serverless, same repo, automatic scaling  |
| **Database**        | Neon (PostgreSQL)          | Serverless Postgres with branching   | Serverless-optimized, branching for environments      |
| **Auth**            | JWT + bcryptjs             | Stateless authentication             | Serverless-friendly, no session storage needed        |

---

## Prerequisites

### Required Tools

- [ ] **Node.js** LTS (v18+ recommended)
- [ ] **Package manager**: `pnpm` (preferred) or `npm`
- [ ] **Git** for version control

### Required Accounts

- [ ] **Netlify account** with CLI installed (`npm install -g netlify-cli`)
- [ ] **Neon account** at https://console.neon.tech

### Verification Commands

```bash
node --version      # Should be v18+
npm --version       # or pnpm --version
git --version
netlify --version
```

---

## Phase 1: Project Initialization

### Step 1.0: Prepare Existing Directory (If Applicable)

This scaffolding plan assumes the project directory may already contain:
- `.windsurf/` rules directory
- `db_ref.md` database reference
- `README.md` and other documentation
- `.git/` version control

**If the directory is NOT empty:**

```bash
# Initialize package.json first (skip if exists)
npm init -y

# Install Vite and React manually
npm install vite @vitejs/plugin-react
npm install react react-dom
npm install -D typescript @types/react @types/react-dom
```

**If starting fresh in an empty directory:**

```bash
npm create vite@latest . -- --template react-ts
```

> **Note:** The `npm create vite@latest` command will fail if the directory contains files. Use the manual installation approach above for existing projects.

### Step 1.1: Create Core Source Files

After installing dependencies, create the minimal Vite + React structure:

```bash
# Create source directory structure
mkdir -p src

# Create entry files (templates provided in Phase 2)
touch src/main.tsx src/App.tsx src/index.css src/vite-env.d.ts
touch index.html
```

### Step 1.2: Install Core Dependencies

```bash
# Core React dependencies
npm install react-router-dom

# Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# shadcn/ui prerequisites
npm install -D @types/node
npm install class-variance-authority clsx tailwind-merge lucide-react

# Netlify Functions
npm install @netlify/functions

# Database
npm install @neondatabase/serverless

# Authentication
npm install jsonwebtoken bcryptjs
npm install -D @types/jsonwebtoken @types/bcryptjs
```

### Step 1.3: Install Development Dependencies

```bash
# Linting and formatting
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install -D eslint-plugin-react-hooks eslint-plugin-react-refresh
npm install -D prettier eslint-config-prettier

# Testing
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event jsdom

# Tailwind v4 PostCSS plugin (required)
npm install -D @tailwindcss/postcss

# Tailwind animation plugin (required for shadcn/ui)
npm install -D tailwindcss-animate
```

### Step 1.4: Initialize shadcn/ui

```bash
npx shadcn@latest init
```

**Configuration options:**
- TypeScript: **Yes**
- Style: **Default**
- Base color: **Slate** (or project preference)
- CSS variables: **Yes**

### Step 1.5: Add Common shadcn/ui Components

```bash
npx shadcn@latest add button input label card
npx shadcn@latest add form toast dialog
```

### Step 1.6: Configure Package Scripts

Update `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\"",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

---

## Phase 2: Directory Structure

```
project-name/
├── .windsurf/                    # IDE rules and standards
│   ├── security.md
│   ├── code-quality.md
│   ├── testing.md
│   ├── database-design.md
│   ├── neon-database.md
│   ├── api-design.md
│   ├── cleanup.md
│   ├── frontend-components.md
│   └── ai-gateway.md
│
├── netlify/
│   └── functions/                # Serverless API functions (flat structure)
│       ├── auth-signup.ts        # POST /api/auth/signup
│       ├── auth-signin.ts        # POST /api/auth/signin
│       ├── auth-me.ts            # GET /api/auth/me
│       └── [domain]-[action].ts  # Additional endpoints (flat naming)
│
├── migrations/                   # SQL migration files
│   └── 001_initial_schema.sql
│
├── src/
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components (auto-generated)
│   │   ├── auth/                 # Auth-related components
│   │   │   └── ProtectedRoute.tsx
│   │   ├── layout/               # Layout components (Header, Footer, etc.)
│   │   └── [domain]/             # Domain-specific components
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx
│   │
│   ├── hooks/                    # Custom React hooks
│   │   └── useAuth.ts
│   │
│   ├── lib/
│   │   ├── utils.ts              # Utility functions (cn helper)
│   │   └── auth-client.ts        # Auth client
│   │
│   ├── pages/                    # Route page components
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── SignupPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   └── HomePage.tsx
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── auth.ts
│   │   └── api.ts
│   │
│   ├── App.tsx                   # Root component with routing
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles (Tailwind directives)
│
├── .env.example                  # Environment variable template
├── .env.local                    # Local env vars (gitignored)
├── .gitignore
├── .prettierrc                   # Prettier configuration
├── .eslintrc.cjs                 # ESLint configuration
├── db_ref.md                     # Database schema reference (REQUIRED)
├── netlify.toml                  # Netlify configuration
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── vitest.config.ts              # Test configuration
```

### Directory Standards

| Directory                  | Purpose                    | Rules                                                 |
|----------------------------|----------------------------|-------------------------------------------------------|
| `src/components/ui/`       | shadcn/ui components       | Do not modify directly; extend via composition        |
| `src/components/[domain]/` | Domain-specific components | Keep focused; one concern per component               |
| `src/lib/`                 | Shared utilities           | Must have clear ownership; avoid "misc" dumping       |
| `src/pages/`               | Route page components      | One file per route; compose from smaller components   |
| `src/types/`               | Shared TypeScript types    | Export interfaces for API boundaries                  |
| `netlify/functions/api/`   | Serverless endpoints       | One function per endpoint; consistent error handling  |
| `migrations/`              | SQL migrations             | Sequential numbering; never modify after deployment   |

### Step 2.1: Core Entry Files

These files must be created when scaffolding in an existing directory.

**`index.html`** (project root):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Project Name</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**`src/main.tsx`**:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**`src/App.tsx`**:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

**`src/index.css`** (Tailwind v4 syntax):

```css
@import "tailwindcss";

@theme {
  --color-background: hsl(0 0% 100%);
  --color-foreground: hsl(222.2 84% 4.9%);
  --color-card: hsl(0 0% 100%);
  --color-card-foreground: hsl(222.2 84% 4.9%);
  --color-popover: hsl(0 0% 100%);
  --color-popover-foreground: hsl(222.2 84% 4.9%);
  --color-primary: hsl(222.2 47.4% 11.2%);
  --color-primary-foreground: hsl(210 40% 98%);
  --color-secondary: hsl(210 40% 96.1%);
  --color-secondary-foreground: hsl(222.2 47.4% 11.2%);
  --color-muted: hsl(210 40% 96.1%);
  --color-muted-foreground: hsl(215.4 16.3% 46.9%);
  --color-accent: hsl(210 40% 96.1%);
  --color-accent-foreground: hsl(222.2 47.4% 11.2%);
  --color-destructive: hsl(0 84.2% 60.2%);
  --color-destructive-foreground: hsl(210 40% 98%);
  --color-border: hsl(214.3 31.8% 91.4%);
  --color-input: hsl(214.3 31.8% 91.4%);
  --color-ring: hsl(222.2 84% 4.9%);
  --radius-lg: 0.5rem;
  --radius-md: calc(0.5rem - 2px);
  --radius-sm: calc(0.5rem - 4px);
}

* {
  border-color: var(--color-border);
}

body {
  background-color: var(--color-background);
  color: var(--color-foreground);
}
```

> **Tailwind v4 Changes:**
> - Use `@import "tailwindcss"` instead of `@tailwind` directives
> - Use `@theme` directive to define custom colors (prefixed with `--color-`)
> - CSS variables use `hsl()` values directly, not space-separated numbers
> - `@apply` is still supported but plain CSS is preferred for base styles

**`src/vite-env.d.ts`**:

```typescript
/// <reference types="vite/client" />
```

---

## Phase 3: Configuration Files

### Step 3.1: Tailwind CSS v4 Configuration

> **Note:** Tailwind CSS v4 uses a different configuration approach than v3. The PostCSS plugin is now in a separate package `@tailwindcss/postcss`, and CSS uses the `@theme` directive instead of `@layer base` with CSS variables.

Create `postcss.config.js`:

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

Create/update `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### Step 3.2: Vite Configuration

Create/update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
```

### Step 3.3: TypeScript Configuration

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Strict mode - ALL REQUIRED */
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    /* Path aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

### Step 3.4: Netlify Configuration

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "18"
  NPM_FLAGS = "--include=dev"  # Required: ensures TypeScript is installed during build

[functions]
  node_bundler = "esbuild"

# API routes redirect to functions
# IMPORTANT: Use flat function naming (auth-signup.ts, not api/auth/signup.ts)
# Each function file maps to a specific route
[[redirects]]
  from = "/api/auth/signup"
  to = "/.netlify/functions/auth-signup"
  status = 200

[[redirects]]
  from = "/api/auth/signin"
  to = "/.netlify/functions/auth-signin"
  status = 200

[[redirects]]
  from = "/api/auth/me"
  to = "/.netlify/functions/auth-me"
  status = 200

# SPA fallback - must be last
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Production context
[context.production]
  environment = { NODE_ENV = "production" }

# Preview context (PR deploys)
[context.deploy-preview]
  environment = { NODE_ENV = "production" }

# Branch deploy context
[context.branch-deploy]
  environment = { NODE_ENV = "production" }
```

> **Important Notes:**
> - `NPM_FLAGS = "--include=dev"` is required because Netlify sets `NODE_ENV=production` which skips devDependencies by default. TypeScript must be installed for the build to succeed.
> - Netlify Functions must use **flat file naming** (e.g., `auth-signup.ts`) rather than nested directories. Each redirect explicitly maps an API path to its function.

### Step 3.5: ESLint Configuration

Create `.eslintrc.cjs`:

```javascript
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'tailwind.config.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['react-refresh', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
    'no-console': 'warn',
    'eqeqeq': 'error',
  },
}
```

### Step 3.6: Prettier Configuration

Create `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

### Step 3.7: Vitest Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

### Step 3.8: Git Ignore

Create/update `.gitignore`:

```gitignore
# Dependencies
node_modules/

# Build output
dist/
.netlify/

# Environment files
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Test coverage
coverage/

# Temporary
*.tmp
*.temp
```

---

## Phase 4: Environment Variables

### Step 4.1: Create `.env.example`

```bash
# ===========================================
# DATABASE
# ===========================================
# Neon PostgreSQL connection string
# Format: postgresql://user:password@host/database?sslmode=require
DATABASE_URL=

# ===========================================
# AUTHENTICATION
# ===========================================
# JWT signing secret (min 32 characters, cryptographically random)
# Generate with: openssl rand -base64 32
JWT_SECRET=

# ===========================================
# FRONTEND (Vite - must use VITE_ prefix)
# ===========================================
# API base URL (optional, defaults to relative /api)
# VITE_API_URL=

# ===========================================
# AI GATEWAY (Optional - auto-injected by Netlify)
# ===========================================
# Only set these if using your own API keys
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
# GEMINI_API_KEY=
```

### Step 4.2: Environment Strategy

| Variable       | Local (.env.local)  | Preview (Netlify)     | Production (Netlify) |
|----------------|---------------------|-----------------------|----------------------|
| `DATABASE_URL` | Neon `dev` branch   | Neon `preview` branch | Neon `main` branch   |
| `JWT_SECRET`   | Local dev secret    | Unique preview secret | Production secret    |
| `NODE_ENV`     | development         | production            | production           |
| `VITE_*`       | Dev values          | Preview values        | Production values    |

### Step 4.3: Environment Variable Rules

**Required for all environments:**
- `DATABASE_URL` - Neon connection string with SSL
- `JWT_SECRET` - Minimum 32 characters, cryptographically random

**Frontend variables:**
- Must use `VITE_` prefix to be accessible in browser
- **Never** expose secrets to frontend

**Security requirements:**
- Never commit real secrets to version control
- Functions must fail fast with clear errors if required env vars are missing
- Error messages must not include secret values

### Step 4.4: Netlify Environment Setup

1. Navigate to **Site Settings > Environment Variables**
2. Add required variables:
   - `DATABASE_URL` - Production Neon connection string
   - `JWT_SECRET` - Generate with `openssl rand -base64 32`
3. Configure deploy contexts for preview environments
4. Use Neon branch URLs for preview deploys

---

## Phase 5: Database Setup

### Step 5.1: Neon Project Creation

1. Create a Neon project at https://console.neon.tech
2. Note the connection string for the `main` branch
3. **Enable connection pooling** (required for serverless)
4. Copy the **pooled** connection string

### Step 5.2: Branch Strategy

| Environment      | Neon Branch              | Connection       | Purpose                  |
|------------------|--------------------------|------------------|--------------------------|
| **Local Dev**    | `dev`                    | Direct or pooled | Individual development   |
| **Preview**      | `preview` or `preview-{PR}` | Pooled        | PR-specific testing      |
| **Production**   | `main`                   | Pooled           | Live application         |

**Branch rules:**
- Never point preview or dev to the production branch
- Create branches from `main` for isolated testing
- Reset dev branches periodically from production
- Delete stale preview branches

### Step 5.3: Initial Migration

Create `migrations/001_initial_schema.sql`:

```sql
-- ============================================
-- Initial Schema Migration
-- ============================================

-- Users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  phone_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenants table (multi-tenancy support)
CREATE TABLE tenants (
  tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membership role enum
CREATE TYPE membership_role AS ENUM ('owner', 'member');

-- Memberships table (user-tenant relationship)
CREATE TABLE memberships (
  membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role membership_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- ============================================
-- Indexes for common query patterns
-- ============================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_memberships_tenant_id ON memberships(tenant_id);
CREATE INDEX idx_memberships_user_id ON memberships(user_id);

-- ============================================
-- Updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Step 5.4: Running Migrations

```bash
# Connect to Neon and run migration
psql $DATABASE_URL -f migrations/001_initial_schema.sql
```

### Step 5.5: Update db_ref.md

After running migrations, **immediately update `/db_ref.md`** with:
- All table definitions with column types
- All constraints (PK, FK, UNIQUE, CHECK)
- All indexes
- Foreign key relationships
- Approximate row counts (update periodically)

**This file is the single source of truth for database schema.**

---

## Phase 6: Authentication Implementation

### Step 6.1: Authentication Requirements

| Requirement      | Value                                              |
|------------------|----------------------------------------------------|
| Token storage    | `localStorage` key: `"auth_token"`                 |
| Token expiry     | 7 days                                             |
| Password hashing | bcryptjs, 12 salt rounds                           |
| JWT payload      | `{ userId, email, tenantId }` (tenantId nullable)  |

### Step 6.2: Backend API Endpoints

#### POST `/api/auth/signup`

**Input:**
```typescript
interface SignupRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  tenantSlug?: string;  // Join existing tenant
  tenantName?: string;  // Create new tenant
}
```

**Behavior:**
- Hash password with bcryptjs (12 rounds)
- If `tenantSlug` provided: join that tenant as member
- Else if `tenantName` provided: create tenant and assign user as owner
- Else: create user without tenant

**Response:**
```typescript
interface SignupResponse {
  success: true;
  user: { id: string; email: string; fullName: string; createdAt: string };
  token: string;
  tenantId: string | null;
}
```

#### POST `/api/auth/signin`

**Input:**
```typescript
interface SigninRequest {
  email: string;
  password: string;
}
```

**Response:**
```typescript
interface SigninResponse {
  success: true;
  user: { id: string; email: string; fullName: string; createdAt: string };
  token: string;
  tenantId: string | null;
}
```

#### GET `/api/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```typescript
interface MeResponse {
  success: true;
  user: {
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    phoneVerifiedAt?: string;
    createdAt: string;
    updatedAt: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    role: 'owner' | 'member';
  } | null;
}
```

### Step 6.3: Frontend Auth Client

Create `src/lib/auth-client.ts`:

**Responsibilities:**
- Maintain in-memory token, user, and tenant state
- Persist token to localStorage (`"auth_token"`)
- API calls to auth endpoints
- Clear token on 401 responses

**Required methods:**
- `signUp(data)` - Register new user
- `signInWithPassword(email, password)` - Login
- `signOut()` - Clear session
- `getSession()` - Fetch current session from `/api/auth/me`
- `getUser()` - Get cached user
- `onAuthStateChange(callback)` - Subscribe to auth changes

### Step 6.4: Auth Context

Create `src/contexts/AuthContext.tsx`:

**Responsibilities:**
- `AuthProvider` wraps app
- Call `auth.getSession()` on mount
- Expose: `user`, `session`, `tenant`, `loading`, `signUp`, `signIn`, `signOut`

### Step 6.5: Protected Route Component

Create `src/components/auth/ProtectedRoute.tsx`:

**Behavior:**
- If `loading`: render skeleton/spinner
- If unauthenticated: redirect to `/auth/login?returnUrl={currentPath}`
- If authenticated: render children

### Step 6.6: Auth Pages

| Route           | Component        | Purpose                          |
|-----------------|------------------|----------------------------------|
| `/auth/login`   | `LoginPage.tsx`  | Email/password sign in           |
| `/auth/signup`  | `SignupPage.tsx` | Registration with tenant options |

### Step 6.7: Route Configuration

In `App.tsx`:

```typescript
<AuthProvider>
  <Routes>
    {/* Public routes */}
    <Route path="/" element={<HomePage />} />
    <Route path="/auth/login" element={<LoginPage />} />
    <Route path="/auth/signup" element={<SignupPage />} />
    
    {/* Protected routes */}
    <Route element={<ProtectedRoute />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      {/* Add more protected routes */}
    </Route>
  </Routes>
</AuthProvider>
```

---

## Phase 7: Netlify Deployment

### Step 7.1: Initial Deployment

1. **Connect repository to Netlify:**
   - Link GitHub/GitLab repository
   - Netlify auto-detects `netlify.toml` settings

2. **Configure build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`

3. **Add environment variables:**
   - `DATABASE_URL` - Production Neon connection
   - `JWT_SECRET` - Production secret

4. **Deploy:**
   - Trigger initial deploy
   - Verify build succeeds
   - Test production URL

### Step 7.2: CI/CD Behavior

Netlify automatically:
- Builds on push to main branch → Production deploy
- Creates preview deploys for PRs → Unique preview URL
- Runs build command and publishes dist folder
- Deploys functions alongside frontend

### Step 7.3: Preview Deploy Configuration

For preview deploys with separate database:

1. Create Neon `preview` branch
2. Add context-specific env var in Netlify:
   - Context: `deploy-preview`
   - Variable: `DATABASE_URL`
   - Value: Preview branch connection string

### Step 7.4: Custom Domain (Optional)

1. Add custom domain in Netlify Site Settings
2. Configure DNS records as instructed
3. Enable HTTPS (automatic with Let's Encrypt)

---

## Phase 8: Post-Setup Verification

### Development Verification

- [ ] `npm run dev` starts local development server on port 5173
- [ ] `npm run build` completes without errors
- [ ] `npm run lint` passes with no errors
- [ ] `npm run typecheck` passes with no errors
- [ ] `npm run test` runs successfully

### Frontend Verification

- [ ] Tailwind CSS classes apply correctly
- [ ] shadcn/ui components render properly
- [ ] Routing works (navigate between pages)
- [ ] Dark mode toggle works (if implemented)

### Backend Verification

- [ ] Database connection works from Netlify Functions
- [ ] `/api/auth/signup` creates user and returns token
- [ ] `/api/auth/signin` authenticates and returns token
- [ ] `/api/auth/me` returns user data with valid token
- [ ] Invalid tokens return 401

### Authentication Flow Verification

- [ ] Sign up creates user and logs in
- [ ] Sign up with tenant creates/joins tenant
- [ ] Sign in with valid credentials succeeds
- [ ] Sign in with invalid credentials fails gracefully
- [ ] Session persists across page refresh
- [ ] Protected routes redirect when unauthenticated
- [ ] Protected routes accessible when authenticated
- [ ] Sign out clears token and redirects

### Production Verification

- [ ] Production deploy succeeds on Netlify
- [ ] Environment variables are properly configured
- [ ] All verification steps pass on production URL
- [ ] HTTPS is enabled and working

---

## Reusability Guidance

### For New Projects

1. **Clone or copy** this scaffolding structure
2. **Update** `package.json` with new project name
3. **Create** new Neon project and update `DATABASE_URL`
4. **Generate** new `JWT_SECRET` with `openssl rand -base64 32`
5. **Run** migrations on new database
6. **Update** `db_ref.md` with schema
7. **Connect** to new Netlify site
8. **Configure** environment variables

### Customization Points

| Area                | How to Customize                                      |
|---------------------|-------------------------------------------------------|
| **UI Theme**        | Modify `tailwind.config.js` and CSS variables         |
| **Auth Fields**     | Extend users/tenants tables via migrations            |
| **API Routes**      | Add new functions under `netlify/functions/api/`      |
| **Database Schema** | Add migrations in `migrations/` directory             |
| **Components**      | Add shadcn/ui components with `npx shadcn@latest add` |

### What to Keep Consistent

| Element                     | Standard                                   |
|-----------------------------|--------------------------------------------|
| Directory structure         | As defined in Phase 2                      |
| Environment variable naming | `DATABASE_URL`, `JWT_SECRET`, `VITE_*`     |
| Auth token storage key      | `"auth_token"`                             |
| API route patterns          | `/api/*`                                   |
| TypeScript strictness       | All strict options enabled                 |
| Code quality standards      | See `.windsurf/` rules                     |

### Template Repository Maintenance

- Maintain scaffold as a dedicated template repository
- Tag stable versions for easy cloning
- Keep app-specific logic out of the scaffold
- Add features only when broadly reusable

---

## Tooling Justification

| Tool                  | Reason                                                            |
|-----------------------|-------------------------------------------------------------------|
| **Vite**              | Fast HMR, native ESM, excellent TypeScript support, modern defaults |
| **React**             | Component model, ecosystem maturity, team familiarity             |
| **TypeScript**        | Type safety, better DX, catch errors at compile time              |
| **Tailwind CSS**      | Rapid styling, consistent design system, small production bundle  |
| **shadcn/ui**         | Accessible by default, customizable, copy-paste ownership model   |
| **react-router-dom**  | Industry standard, flexible, well-documented                      |
| **Netlify**           | Simple deploys, serverless functions, edge network, preview deploys |
| **Netlify Functions** | Zero-config serverless, same repo as frontend, automatic scaling  |
| **Neon**              | Serverless Postgres, branching for environments, connection pooling |
| **JWT**               | Stateless auth, serverless-friendly, no session storage needed    |
| **bcryptjs**          | Secure password hashing, pure JS (no native dependencies)         |
| **Vitest**            | Fast, Vite-native, Jest-compatible API                            |
| **ESLint + Prettier** | Consistent code style, catch errors early                         |

---

## Rules Reference

All projects using this scaffold must follow the rules defined in `/.windsurf/`:

| File                     | Purpose                                                    |
|--------------------------|------------------------------------------------------------|
| `security.md`            | Secrets handling, auth boundaries, logging prohibitions    |
| `code-quality.md`        | TypeScript strictness, naming conventions, file organization |
| `testing.md`             | Unit/integration testing standards, coverage expectations  |
| `database-design.md`     | Schema standards, migration rules, `/db_ref.md` requirements |
| `neon-database.md`       | Serverless connection handling, branch strategy            |
| `api-design.md`          | REST conventions, error handling, response structure       |
| `cleanup.md`             | Safe refactoring, soft deletions, backup requirements      |
| `frontend-components.md` | React/Tailwind/shadcn/ui component standards               |
| `ai-gateway.md`          | Netlify AI Gateway usage, rate limiting, security          |

**Key rule:** Always consult `/db_ref.md` before any database work.

---

## Quick Reference Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build

# Quality
npm run lint             # Run ESLint
npm run format           # Run Prettier
npm run typecheck        # TypeScript check

# Testing
npm run test             # Run tests
npm run test:coverage    # Run tests with coverage

# Netlify
netlify dev              # Local dev with functions
netlify deploy           # Deploy preview
netlify deploy --prod    # Deploy production

# Database
psql $DATABASE_URL       # Connect to database
psql $DATABASE_URL -f migrations/XXX.sql  # Run migration

# shadcn/ui
npx shadcn@latest add [component]  # Add component
```

---

*This plan is the authoritative reference for project scaffolding. Follow it precisely for consistent, production-ready applications.*
