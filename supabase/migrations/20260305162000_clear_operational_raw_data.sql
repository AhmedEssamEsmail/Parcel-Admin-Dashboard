truncate table
  public.delivery_details,
  public.parcel_logs,
  public.collectors_report,
  public.prepare_report,
  public.items_per_order,
  public.freshdesk_tickets,
  public.wa_orders,
  public.ingest_runs,
  public.data_quality_issues,
  public.delivery_exceptions,
  public.exception_actions,
  public.api_rate_limits
restart identity cascade;
