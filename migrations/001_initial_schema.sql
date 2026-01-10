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
