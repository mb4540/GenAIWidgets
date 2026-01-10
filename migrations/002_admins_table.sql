-- Migration: 002_admins_table
-- Description: Add admins table for system-wide cross-tenant access
-- Created: 2026-01-10

-- Create admins table
CREATE TABLE admins (
  admin_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  granted_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast admin lookups
CREATE INDEX idx_admins_user_id ON admins(user_id);

-- Add comment for documentation
COMMENT ON TABLE admins IS 'System-wide administrator access for cross-tenant operations';
COMMENT ON COLUMN admins.granted_by IS 'User ID of admin who granted this access';
COMMENT ON COLUMN admins.granted_at IS 'Timestamp when admin access was granted';
