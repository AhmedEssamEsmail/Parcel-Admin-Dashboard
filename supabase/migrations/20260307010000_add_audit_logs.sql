-- Migration: Add audit logs table for tracking user and system actions
-- Created: 2026-03-07
-- Description: Creates audit_logs table with indexes for efficient querying

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs (event_type);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON public.audit_logs (user_id, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for service role (full access)
CREATE POLICY "Service role has full access to audit_logs"
  ON public.audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy for authenticated users (read-only access to their own logs)
CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE public.audit_logs IS 'Audit log entries for tracking user and system actions';
COMMENT ON COLUMN public.audit_logs.event_type IS 'Type of event (e.g., auth.login, data.upload)';
COMMENT ON COLUMN public.audit_logs.user_id IS 'ID of the user who performed the action';
COMMENT ON COLUMN public.audit_logs.ip_address IS 'IP address of the client';
COMMENT ON COLUMN public.audit_logs.user_agent IS 'User agent string of the client';
COMMENT ON COLUMN public.audit_logs.resource_type IS 'Type of resource affected (e.g., parcel, delivery)';
COMMENT ON COLUMN public.audit_logs.resource_id IS 'ID of the resource affected';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional metadata about the event';
