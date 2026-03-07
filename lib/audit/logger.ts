import { getSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Audit event types for tracking user and system actions
 */
export enum AuditEventType {
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  DATA_UPLOAD = 'data.upload',
  DATA_DELETE = 'data.delete',
  CONFIG_CHANGE = 'config.change',
}

/**
 * Audit event interface for structured logging
 */
export interface AuditEvent {
  eventType: AuditEventType;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event to the database
 * @param event - The audit event to log
 * @returns Promise that resolves when the event is logged
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase.from('audit_logs').insert({
      event_type: event.eventType,
      user_id: event.userId,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      metadata: event.metadata,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging should not break the main flow
    }
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Middleware wrapper that adds audit logging to API route handlers
 * @param handler - The API route handler to wrap
 * @param eventType - The audit event type to log
 * @param getMetadata - Optional function to extract metadata from the request
 * @returns Wrapped handler with audit logging
 */
export function withAuditLog<T>(
  handler: (request: Request, context?: T) => Promise<Response>,
  eventType: AuditEventType,
  getMetadata?: (request: Request, response: Response) => Record<string, unknown>
) {
  return async (request: Request, context?: T): Promise<Response> => {
    const response = await handler(request, context);

    // Extract request metadata
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Log the audit event asynchronously (don't await)
    logAuditEvent({
      eventType,
      ipAddress,
      userAgent,
      metadata: getMetadata ? getMetadata(request, response) : undefined,
    }).catch((error) => {
      console.error('Audit logging failed:', error);
    });

    return response;
  };
}
