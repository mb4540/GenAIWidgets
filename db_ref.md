# Database Reference

**Single Source of Truth for Database Schema**

*Last Updated: [DATE]*

---

## Overview

This document contains the authoritative schema definition for the project database. All database-related code must reference this file.

---

## Tables

### users

User account information.

| Column            | Type        | Nullable | Default           | Description              |
|-------------------|-------------|----------|-------------------|--------------------------|
| user_id           | UUID        | NO       | gen_random_uuid() | Primary key              |
| email             | TEXT        | NO       | -                 | Unique email address     |
| password_hash     | TEXT        | NO       | -                 | bcrypt hashed password   |
| full_name         | TEXT        | NO       | -                 | User's display name      |
| phone             | TEXT        | YES      | NULL              | Phone number             |
| phone_verified_at | TIMESTAMPTZ | YES      | NULL              | When phone was verified  |
| created_at        | TIMESTAMPTZ | NO       | now()             | Record creation time     |
| updated_at        | TIMESTAMPTZ | NO       | now()             | Last update time         |

**Constraints:**
- PRIMARY KEY: `user_id`
- UNIQUE: `email`

**Indexes:**
- `idx_users_email` on `email`

---

### tenants

Multi-tenant organization records.

| Column     | Type        | Nullable | Default           | Description          |
|------------|-------------|----------|-------------------|----------------------|
| tenant_id  | UUID        | NO       | gen_random_uuid() | Primary key          |
| name       | TEXT        | NO       | -                 | Organization name    |
| slug       | TEXT        | NO       | -                 | URL-safe identifier  |
| created_at | TIMESTAMPTZ | NO       | now()             | Record creation time |

**Constraints:**
- PRIMARY KEY: `tenant_id`
- UNIQUE: `slug`

**Indexes:**
- `idx_tenants_slug` on `slug`

---

### memberships

User-tenant relationship with roles.

| Column        | Type            | Nullable | Default           | Description           |
|---------------|-----------------|----------|-------------------|-----------------------|
| membership_id | UUID            | NO       | gen_random_uuid() | Primary key           |
| tenant_id     | UUID            | NO       | -                 | Reference to tenant   |
| user_id       | UUID            | NO       | -                 | Reference to user     |
| role          | membership_role | NO       | 'member'          | User's role in tenant |
| created_at    | TIMESTAMPTZ     | NO       | now()             | Record creation time  |

**Constraints:**
- PRIMARY KEY: `membership_id`
- FOREIGN KEY: `tenant_id` REFERENCES `tenants(tenant_id)` ON DELETE CASCADE
- FOREIGN KEY: `user_id` REFERENCES `users(user_id)` ON DELETE CASCADE
- UNIQUE: `(tenant_id, user_id)`

**Indexes:**
- `idx_memberships_tenant_id` on `tenant_id`
- `idx_memberships_user_id` on `user_id`

---

## Enums

### membership_role

```sql
CREATE TYPE membership_role AS ENUM ('owner', 'member');
```

| Value  | Description                 |
|--------|-----------------------------|
| owner  | Full administrative access  |
| member | Standard member access      |

---

## Relationships

```
users (1) ──────< memberships >────── (1) tenants
         user_id              tenant_id
```

- A user can belong to multiple tenants (via memberships)
- A tenant can have multiple users (via memberships)
- Each membership has exactly one user and one tenant

---

## Row Counts

*Update these periodically for query planning*

| Table       | Approximate Rows | Last Checked |
|-------------|------------------|--------------|
| users       | 0                | [DATE]       |
| tenants     | 0                | [DATE]       |
| memberships | 0                | [DATE]       |

---

## Migration History

| Version | File                   | Description                                    | Applied |
|---------|------------------------|------------------------------------------------|---------|
| 001     | 001_initial_schema.sql | Initial schema with users, tenants, memberships | [DATE]  |

---

## Common Queries

### Get user with tenant info

```sql
SELECT 
  u.user_id,
  u.email,
  u.full_name,
  t.tenant_id,
  t.name AS tenant_name,
  t.slug AS tenant_slug,
  m.role
FROM users u
LEFT JOIN memberships m ON u.user_id = m.user_id
LEFT JOIN tenants t ON m.tenant_id = t.tenant_id
WHERE u.user_id = $1;
```

### Get all members of a tenant

```sql
SELECT 
  u.user_id,
  u.email,
  u.full_name,
  m.role,
  m.created_at AS joined_at
FROM memberships m
JOIN users u ON m.user_id = u.user_id
WHERE m.tenant_id = $1
ORDER BY m.created_at;
```

### Check if user is tenant member

```sql
SELECT EXISTS (
  SELECT 1 FROM memberships 
  WHERE user_id = $1 AND tenant_id = $2
) AS is_member;
```

---

## Notes

- All timestamps use `TIMESTAMPTZ` for timezone awareness
- UUIDs are generated server-side with `gen_random_uuid()`
- Passwords are hashed with bcrypt (12 rounds) before storage
- Cascade deletes: removing a user/tenant removes their memberships

---

*This file must be updated whenever schema changes are made.*
