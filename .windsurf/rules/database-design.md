---
trigger: model_decision
---
# Database Design Rules

PostgreSQL schema design and evolution standards.

---

## Database Reference File (Mandatory)

### The Single Source of Truth

**ALWAYS consult `/db_ref.md` located in the project root before any database work.**

`/db_ref.md` is the authoritative reference for:
- All tables and columns
- All foreign keys and relationships
- All indexes and constraints
- Current row counts and approximate table sizes

### Enforcement

- **No schema changes** may be proposed without first reading `/db_ref.md`
- **No queries** may be written without verifying table/column names in `/db_ref.md`
- **No migrations** may be created without updating `/db_ref.md`
- **All PRs** with database changes must include `/db_ref.md` updates

---

## Schema Design Standards

### Primary Keys

- Every table MUST have an explicit primary key
- Use `UUID` with `DEFAULT gen_random_uuid()` for new tables
- Never use composite primary keys unless absolutely necessary
- Never expose sequential IDs externally (use UUIDs)

### Foreign Keys

- All relationships MUST have foreign key constraints
- Define `ON DELETE` behavior explicitly:
  - `CASCADE` for child records that cannot exist without parent
  - `SET NULL` for optional relationships
  - `RESTRICT` for protected references
- Document any missing foreign key with justification

### Nullable vs Non-Nullable

- Columns are `NOT NULL` by default unless explicitly optional
- Document why a column is nullable
- Use empty strings or zero values only when semantically meaningful
- Never use `NULL` to represent "unknown" and "not applicable" in the same column

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `users`, `order_items` |
| Columns | snake_case | `created_at`, `user_id` |
| Primary keys | `{singular}_id` | `user_id`, `order_id` |
| Foreign keys | `{referenced_table_singular}_id` | `user_id`, `tenant_id` |
| Indexes | `idx_{table}_{columns}` | `idx_users_email` |
| Constraints | `{table}_{type}_{columns}` | `users_unique_email` |

### Data Types

| Use Case | Type | Notes |
|----------|------|-------|
| Identifiers | `UUID` | Use `gen_random_uuid()` |
| Timestamps | `TIMESTAMPTZ` | Always with timezone |
| Money | `NUMERIC(12,2)` | Never use `FLOAT` |
| Short text | `TEXT` | PostgreSQL optimizes automatically |
| Long text | `TEXT` | Same as short text in PostgreSQL |
| Boolean | `BOOLEAN` | Never use integers |
| Enums | `CREATE TYPE ... AS ENUM` | For fixed value sets |
| JSON | `JSONB` | For flexible schemas |

---

## Indexing Strategy

### Required Indexes

- Primary keys (automatic)
- Foreign keys (NOT automatic—create explicitly)
- Columns used in `WHERE` clauses frequently
- Columns used in `ORDER BY` frequently
- Columns used in `JOIN` conditions

### Index Guidelines

- Create indexes based on actual query patterns
- Composite indexes: order columns by selectivity (most selective first)
- Consider partial indexes for filtered queries
- Monitor index usage and remove unused indexes

### Prohibited Practices

- Indexing every column "just in case"
- Ignoring index maintenance costs
- Creating duplicate indexes
- Indexes on low-cardinality columns without justification

---

## Migration & Change Management

### Migration File Naming

```
migrations/
├── 001_initial_schema.sql
├── 002_add_user_phone.sql
├── 003_create_orders_table.sql
└── ...
```

### Additive Changes (Preferred)

- Adding new tables
- Adding new nullable columns
- Adding new indexes
- Adding new constraints (with validation)

### Destructive Changes (Require Justification)

- Dropping tables or columns
- Changing column types
- Removing constraints
- Renaming tables or columns

### Migration Rules

1. Each migration must be idempotent where possible
2. Include rollback instructions in comments
3. Test migrations on a copy of production data
4. Never modify existing migration files after deployment
5. Keep migrations small and focused

### Schema Sync Requirements

After every migration:
1. Run migration on target environment
2. Update `/db_ref.md` with changes
3. Verify application compatibility
4. Update TypeScript types if needed

---

## Data Integrity

### Prefer Database Constraints

Use database-level enforcement over application logic:

| Requirement | Implementation |
|-------------|----------------|
| Required field | `NOT NULL` |
| Unique value | `UNIQUE` constraint |
| Valid reference | `FOREIGN KEY` |
| Value range | `CHECK` constraint |
| Default value | `DEFAULT` clause |

### Application vs Database Validation

| Validation Type | Where |
|-----------------|-------|
| Format validation | Application (with DB backup) |
| Business rules | Application |
| Referential integrity | Database |
| Uniqueness | Database |
| Required fields | Both |

### Transaction Guidelines

- Use transactions for multi-statement operations
- Keep transactions short
- Handle deadlocks with retry logic
- Set appropriate isolation levels

---

## Normalization

### Default: Normalize

- Follow 3NF (Third Normal Form) by default
- Eliminate redundant data
- Use foreign keys for relationships
- Store each fact once

### When to Denormalize

Document justification for any denormalization:
- Performance-critical read paths
- Audit/history tables
- Reporting aggregates
- Cache tables

### Denormalization Rules

- Document the source of truth
- Define sync mechanism
- Accept eventual consistency tradeoffs
- Monitor for drift

---

## Serverless Considerations

### Connection Efficiency

- Design for short-lived connections
- Avoid long-running transactions
- Minimize round trips per request
- Use batch operations where possible

### Query Optimization

- Avoid N+1 query patterns
- Use JOINs instead of multiple queries
- Limit result sets with pagination
- Use appropriate indexes

---

## Prohibited Practices

### Schema

- Making schema assumptions without consulting `/db_ref.md`
- Silent schema drift between environments
- Temporary tables without cleanup plan
- Undocumented columns or tables
- Using reserved words as identifiers

### Data

- Storing sensitive data unencrypted
- Storing files in database (use object storage)
- Unbounded text fields for structured data
- Implicit type coercion

### Operations

- Running migrations without backup
- Modifying production data directly
- Blind reliance on ORM defaults
- Ignoring query performance

---

## Review Checklist

Before any database change:

- [ ] Consulted `/db_ref.md`
- [ ] Migration file created and tested
- [ ] Rollback plan documented
- [ ] `/db_ref.md` updated
- [ ] TypeScript types updated
- [ ] Indexes reviewed for new queries
- [ ] Foreign keys defined for relationships
- [ ] Constraints added for data integrity
- [ ] Performance impact assessed

---

*The database is the foundation. Treat schema changes with appropriate gravity.*
