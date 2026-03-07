-- Rollback: Remove audit logs table
-- Created: 2026-03-07
-- Description: Drops audit_logs table and all associated indexes and policies

-- Drop policies first
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role has full access to audit_logs" ON public.audit_logs;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_audit_logs_user_timestamp;
DROP INDEX IF EXISTS public.idx_audit_logs_event_type;
DROP INDEX IF EXISTS public.idx_audit_logs_user_id;
DROP INDEX IF EXISTS public.idx_audit_logs_timestamp;

-- Drop table
DROP TABLE IF EXISTS public.audit_logs;
