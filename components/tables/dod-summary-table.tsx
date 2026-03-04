import { formatDateMmmDd } from "@/lib/utils/date-format";

type DodRow = {
  day: string;
  total_placed: number;
  total_delivered: number;
  on_time: number;
  late: number;
  otd_pct: number | null;
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
              <th>Day</th>
              <th>Total Placed</th>
              <th>Total Delivered</th>
              <th>On-Time %</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-cell">
                  No rows in selected range.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.day}>
                  <td>{formatDateMmmDd(row.day)}</td>
                  <td>{row.total_placed}</td>
                  <td>{row.total_delivered}</td>
                  <td>{row.otd_pct === null ? "-" : `${(row.otd_pct * 100).toFixed(2)}%`}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
