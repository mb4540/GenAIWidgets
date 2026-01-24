# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start Vite dev server with Netlify Functions
npm run build        # TypeScript compile + Vite production build
npm run lint         # ESLint with zero warnings allowed
npm run format       # Prettier formatting
npm run typecheck    # TypeScript type checking only
npm run test         # Run Vitest tests
npm run test:coverage # Tests with coverage report
```

## Architecture Overview

**Stack**: React + Vite + TypeScript frontend, Netlify Functions backend, Neon PostgreSQL database, Netlify Blobs for file storage.

### Frontend (`src/`)
- **Routing**: React Router with protected routes via `AuthContext` and `ProtectedRoute` component
- **Layout**: `AppLayout` wraps all authenticated pages with sidebar navigation
- **Pages**: `src/pages/` organized by feature (admin, agent-chat, ai, auth, dashboard, files, rag)
- **Styling**: Tailwind CSS with light/dark theme support via `ThemeProvider`

### Backend (`netlify/functions/`)
- Each function is a standalone TypeScript file mapped via `netlify.toml` redirects (e.g., `/api/auth/signin` → `auth-signin.ts`)
- Shared utilities in `netlify/functions/lib/`:
  - `auth.ts` - JWT verification and user extraction
  - `llm-client.ts` - Unified client for OpenAI, Anthropic, Gemini APIs
  - `encryption.ts` - AES-256 encryption for sensitive data

### Database
- **Schema reference**: `db_ref.md` is the single source of truth for all tables
- **Multi-tenant**: Users belong to tenants via `memberships` table with roles (owner/member)
- **Admin access**: Separate `admins` table for cross-tenant system administrators
- **Key tables**: users, tenants, memberships, admins, files, folders, agents, agent_sessions, agent_tools, mcp_servers

### Agent Mode Feature
The application includes an AI agent system with:
- **Agents**: Configurable AI agents with goals, system prompts, and model selection
- **Sessions**: Conversation sessions with step tracking and goal completion status
- **Tools**: Extensible tool system including MCP server integrations
- **Memory**: Long-term memory storage across sessions

## API Patterns

- All API routes use `/api/` prefix and are defined in `netlify.toml` redirects
- Authentication via JWT in Authorization header
- Functions return JSON with consistent error structure
- Background functions (suffix `-background`) for long-running tasks like extraction and Q&A generation

## Environment Variables

Required in `.env.local`:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (min 32 chars)
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` - AI provider keys (optional if using Netlify AI Gateway)

## Testing

Tests use Vitest with React Testing Library. Test files are co-located with source files using `.test.ts(x)` suffix. Function tests are in `src/test/functions/`.
