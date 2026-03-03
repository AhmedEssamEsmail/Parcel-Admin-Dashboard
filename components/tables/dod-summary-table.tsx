type DodRow = {
  day: string;
  total_orders: number;
  on_time: number;
  late: number;
  on_time_pct: number | null;
};

type Props = {
  rows: DodRow[];
};

export function DodSummaryTable({ rows }: Props) {
  return (
    <div className="table-card">
      <h3>DOD Summary</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Total Orders</th>
              <th>On Time</th>
              <th>Late</th>
              <th>On Time %</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-cell">
                  No rows in selected range.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.day}>
                  <td>{row.day}</td>
                  <td>{row.total_orders}</td>
                  <td>{row.on_time}</td>
                  <td>{row.late}</td>
                  <td>{row.on_time_pct === null ? "-" : `${(row.on_time_pct * 100).toFixed(2)}%`}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
