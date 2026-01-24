-- Migration: Create AI Chat tables
-- Description: Tables for AI Chat feature with session history

-- Create ai_chat_sessions table
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title TEXT,
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for ai_chat_sessions
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_tenant_id ON ai_chat_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_created_at ON ai_chat_sessions(created_at DESC);

-- Create ai_chat_messages table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(session_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for ai_chat_messages
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at ON ai_chat_messages(created_at);

-- Create trigger to update updated_at on ai_chat_sessions
CREATE OR REPLACE FUNCTION update_ai_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_chat_sessions_updated_at ON ai_chat_sessions;
CREATE TRIGGER update_ai_chat_sessions_updated_at
  BEFORE UPDATE ON ai_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_chat_sessions_updated_at();

-- Rollback instructions:
-- DROP TRIGGER IF EXISTS update_ai_chat_sessions_updated_at ON ai_chat_sessions;
-- DROP FUNCTION IF EXISTS update_ai_chat_sessions_updated_at();
-- DROP TABLE IF EXISTS ai_chat_messages;
-- DROP TABLE IF EXISTS ai_chat_sessions;
