---
trigger: model_decision
---
# Neon Database Rules

Neon-specific database usage standards for serverless PostgreSQL.

---

## Overview

Neon is a serverless PostgreSQL platform with features designed for modern development workflows:
- Instant database branching
- Autoscaling compute
- Connection pooling
- Serverless-optimized drivers

---

## Connection Handling

### Serverless Driver

Use the `@neondatabase/serverless` package for Netlify Functions:

```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
```

### Connection String Format

```
postgresql://user:password@host/database?sslmode=require
```

### Required Practices

- Always use SSL (`sslmode=require`)
- Use the serverless driver, not `pg` directly
- Create new connection per function invocation
- Do not cache connections across invocations
- Validate `DATABASE_URL` exists before use

### Prohibited Practices

- Connection pooling within function code (Neon handles this)
- Long-lived connection objects
- Storing connection objects globally
- Disabling SSL

---

## Connection Pooling

### Neon Pooler

Neon provides built-in connection pooling. Use the pooled connection string for:
- High-concurrency scenarios
- Serverless functions
- Preview deployments

### Pooler URL Format

```
postgresql://user:password@host/database?sslmode=require&pgbouncer=true
```

### When to Use Pooler

| Scenario | Use Pooler |
|----------|------------|
| Netlify Functions | Yes |
| Local development | Optional |
| Migrations | No (use direct) |
| Long transactions | No (use direct) |

---

## Environment Separation

### Branch Strategy

| Environment | Neon Branch | Connection |
|-------------|-------------|------------|
| Production | `main` | Production pooler URL |
| Preview | `preview` or PR-specific | Preview pooler URL |
| Development | `dev` | Dev direct URL |

### Branch Naming

- `main` - Production data
- `dev` - Shared development
- `preview-{feature}` - Feature-specific testing
- `staging` - Pre-production validation

### Branch Management

- Create branches from `main` for isolated testing
- Reset dev branches periodically from production
- Delete stale preview branches
- Never branch from non-main for production features

---

## Netlify Functions Integration

### Basic Pattern

```typescript
import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async (event) => {
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error('Database error:', error);
    return { statusCode: 500, body: 'Internal error' };
  }
};
```

### Environment Variables

Configure in Netlify:
- `DATABASE_URL` - Primary connection string
- Use deploy contexts for environment-specific URLs

### Error Handling

- Catch and log database errors
- Return generic errors to clients
- Never expose connection details in errors
- Implement retry logic for transient failures

---

## Query Patterns

### Parameterized Queries (Required)

```typescript
// Correct - parameterized
const users = await sql`SELECT * FROM users WHERE email = ${email}`;

// WRONG - string concatenation
const users = await sql`SELECT * FROM users WHERE email = '${email}'`;
```

### Batch Operations

```typescript
// Efficient batch insert
const values = users.map(u => sql`(${u.email}, ${u.name})`);
await sql`INSERT INTO users (email, name) VALUES ${sql.join(values, ', ')}`;
```

### Transactions

```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!, { fullResults: true });

// For transactions, use the transaction helper
await sql.transaction([
  sql`INSERT INTO orders (user_id, total) VALUES (${userId}, ${total})`,
  sql`UPDATE inventory SET quantity = quantity - 1 WHERE product_id = ${productId}`,
]);
```

---

## Performance Considerations

### Cold Starts

- Neon compute may scale to zero
- First query after idle may have latency
- Consider Neon's "always on" for production
- Design UX to handle initial latency

### Query Optimization

- Use indexes for filtered queries
- Limit result sets
- Avoid SELECT * in production
- Use EXPLAIN ANALYZE for slow queries

### Connection Limits

- Respect Neon plan connection limits
- Use pooler for high concurrency
- Monitor active connections
- Implement backoff for connection errors

---

## Data Safety

### Backups

- Neon provides point-in-time recovery
- Understand your plan's retention period
- Test restore procedures periodically
- Document recovery process

### Branching for Safety

- Create branch before risky migrations
- Test migrations on branch first
- Keep branch until migration verified
- Use branches for data experiments

---

## Anti-Patterns to Avoid

### Connection Anti-Patterns

- Creating connection pools in serverless functions
- Reusing connections across invocations
- Not closing connections (handled by driver)
- Using synchronous database calls

### Query Anti-Patterns

- N+1 queries in loops
- Unbounded SELECT queries
- Missing WHERE clauses on UPDATE/DELETE
- String interpolation in queries

### Branch Anti-Patterns

- Long-lived feature branches with schema drift
- Branching from non-main branches
- Forgetting to delete unused branches
- Running migrations on wrong branch

---

## Monitoring & Debugging

### What to Monitor

- Query latency (p50, p95, p99)
- Connection count
- Error rates
- Compute usage

### Debugging Tools

- Neon console query history
- PostgreSQL EXPLAIN ANALYZE
- Application-level query logging
- Netlify function logs

### Logging Guidelines

- Log query execution time
- Log error details (sanitized)
- Do not log full query with parameters
- Do not log connection strings

---

## Local Development

### Options

1. **Neon Dev Branch**: Connect to a dedicated dev branch
2. **Local PostgreSQL**: Run PostgreSQL locally with Docker
3. **Neon CLI**: Use `neonctl` for branch management

### Local Setup

```bash
# Using Neon dev branch
DATABASE_URL=postgresql://user:pass@dev-host/db?sslmode=require

# Using local PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/devdb
```

### Sync Considerations

- Keep local schema in sync with Neon
- Use same migration files
- Test with production-like data volumes
- Verify queries work on both

---

## Checklist

Before deploying database changes:

- [ ] Tested on Neon branch
- [ ] Migration runs successfully
- [ ] Rollback plan documented
- [ ] Connection string configured per environment
- [ ] Pooler URL used for serverless
- [ ] Error handling implemented
- [ ] Performance acceptable
- [ ] `/db_ref.md` updated

---

*Neon enables powerful workflows. Use branches liberally for safe experimentation.*
