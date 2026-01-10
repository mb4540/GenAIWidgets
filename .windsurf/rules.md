# Workspace Rules

This project follows strict development standards. All rules in this directory are active and must be followed.

## Active Rule Files

The following rule files define the standards for this project:

- **[security.md](./rules/security.md)** - Secrets handling, auth boundaries, logging prohibitions
- **[code-quality.md](./rules/code-quality.md)** - TypeScript strictness, naming conventions, file organization
- **[testing.md](./rules/testing.md)** - Unit/integration testing standards, coverage expectations
- **[database-design.md](./rules/database-design.md)** - Schema standards, migration rules, `/db_ref.md` requirements
- **[neon-database.md](./rules/neon-database.md)** - Serverless connection handling, branch strategy
- **[api-design.md](./rules/api-design.md)** - REST conventions, error handling, response structure
- **[cleanup.md](./rules/cleanup.md)** - Safe refactoring, soft deletions, backup requirements
- **[frontend-components.md](./rules/frontend-components.md)** - React/Tailwind/shadcn/ui component standards
- **[ai-gateway.md](./rules/ai-gateway.md)** - Netlify AI Gateway usage, rate limiting, security

## Key Principles

1. **Safety First** - Secure defaults, least privilege, no credential leakage
2. **Type Safety** - TypeScript strict mode everywhere, no `any` types
3. **Serverless-First** - Design API and DB access for short-lived runtimes
4. **Production Parity** - Local development mimics Netlify contexts and Neon branches

## Critical Requirements

- Always consult `/db_ref.md` before any database work
- Never commit secrets or `.env` files
- Use parameterized queries for all database operations
- Validate all user input on the server
- Hash passwords with bcryptjs (12 salt rounds minimum)
