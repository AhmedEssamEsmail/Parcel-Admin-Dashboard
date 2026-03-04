"use client";

type IngestHealthResponse = {
  summary: {
    total_runs: number;
    warning_runs: number;
    failed_runs: number;
  };
};

type IngestHealthWidgetProps = {
  data: IngestHealthResponse | null;
  loading?: boolean;
};

export function IngestHealthWidget({ data, loading = false }: IngestHealthWidgetProps) {
  return (
    <section className="card ingest-health-widget">
      <h3>Ingestion Health (7d)</h3>
      {loading ? (
        <p className="muted">Loading ingestion health...</p>
      ) : (
        <div className="grid three">
          <div>
            <strong>{data?.summary.total_runs ?? 0}</strong>
            <p className="muted">Total Runs</p>
          </div>
          <div>
            <strong>{data?.summary.warning_runs ?? 0}</strong>
            <p className="muted">With Warnings</p>
          </div>
          <div>
            <strong>{data?.summary.failed_runs ?? 0}</strong>
            <p className="muted">Failed</p>
          </div>
        </div>
      )}
    </section>
  );
}
