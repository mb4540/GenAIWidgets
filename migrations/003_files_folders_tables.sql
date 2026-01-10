-- Migration: 003_files_folders_tables
-- Description: Add files and folders tables for blob storage feature
-- Created: 2026-01-10

-- Create folders table (virtual directories)
CREATE TABLE folders (
  folder_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  folder_name   TEXT NOT NULL,
  folder_path   TEXT NOT NULL,
  parent_path   TEXT NOT NULL DEFAULT '/',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for folders
CREATE INDEX idx_folders_tenant_id ON folders(tenant_id);
CREATE INDEX idx_folders_path ON folders(tenant_id, folder_path);
CREATE UNIQUE INDEX idx_folders_unique_path ON folders(tenant_id, folder_path);

-- Create files table
CREATE TABLE files (
  file_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  blob_key      TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_path     TEXT NOT NULL DEFAULT '/',
  mime_type     TEXT,
  file_size     BIGINT,
  etag          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for files
CREATE INDEX idx_files_tenant_id ON files(tenant_id);
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_path ON files(tenant_id, file_path);
CREATE UNIQUE INDEX idx_files_blob_key ON files(blob_key);

-- Trigger for updated_at on files
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE folders IS 'Virtual directory structure for file organization';
COMMENT ON TABLE files IS 'File metadata with references to Netlify Blob storage';
COMMENT ON COLUMN files.blob_key IS 'UUID key used to store/retrieve file from Netlify Blobs';
COMMENT ON COLUMN files.file_path IS 'Virtual directory path (e.g., /documents/reports/)';
