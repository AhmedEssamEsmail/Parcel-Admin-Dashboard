import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ExceptionsTable } from '@/components/tables/exceptions-table';

describe('ExceptionsTable (Data Table)', () => {
  const mockRows = [
    {
      id: '1',
      warehouse_code: 'WH1',
      parcel_id: 12345,
      exception_type: 'Delayed',
      severity: 'High',
      status: 'Open',
      description: 'Package delayed',
      detected_at: '2024-01-01',
      aging_hours: 24,
      assignee: 'John Doe',
      category: 'Delivery',
    },
    {
      id: '2',
      warehouse_code: 'WH2',
      parcel_id: 67890,
      exception_type: 'Lost',
      severity: 'Critical',
      status: 'Open',
      description: 'Package lost',
      detected_at: '2024-01-02',
      aging_hours: 48,
      assignee: null,
      category: null,
    },
  ];

  it('should render table with data', () => {
    const onToggle = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ExceptionsTable rows={mockRows} selectedIds={[]} onToggle={onToggle} onUpdate={onUpdate} />
    );

    expect(screen.getByText('WH1')).toBeInTheDocument();
    expect(screen.getByText('WH2')).toBeInTheDocument();
    expect(screen.getByText('Delayed')).toBeInTheDocument();
    expect(screen.getByText('Lost')).toBeInTheDocument();
  });

  it('should handle row selection', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ExceptionsTable rows={mockRows} selectedIds={[]} onToggle={onToggle} onUpdate={onUpdate} />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    expect(onToggle).toHaveBeenCalledWith('1', true);
  });

  it('should display selected rows correctly', () => {
    const onToggle = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ExceptionsTable
        rows={mockRows}
        selectedIds={['1']}
        onToggle={onToggle}
        onUpdate={onUpdate}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('should handle acknowledge action', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <ExceptionsTable rows={mockRows} selectedIds={[]} onToggle={onToggle} onUpdate={onUpdate} />
    );

    const ackButtons = screen.getAllByText('Ack');
    await user.click(ackButtons[0]);

    expect(onUpdate).toHaveBeenCalledWith('1', 'acknowledged');
  });

  it('should handle resolve action', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <ExceptionsTable rows={mockRows} selectedIds={[]} onToggle={onToggle} onUpdate={onUpdate} />
    );

    const resolveButtons = screen.getAllByText('Resolve');
    await user.click(resolveButtons[0]);

    expect(onUpdate).toHaveBeenCalledWith('1', 'resolved');
  });

  it('should render empty state when no data', () => {
    const onToggle = vi.fn();
    const onUpdate = vi.fn();

    render(<ExceptionsTable rows={[]} selectedIds={[]} onToggle={onToggle} onUpdate={onUpdate} />);

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.queryByText('WH1')).not.toBeInTheDocument();
  });

  it('should display null values as dashes', () => {
    const onToggle = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ExceptionsTable rows={mockRows} selectedIds={[]} onToggle={onToggle} onUpdate={onUpdate} />
    );

    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });
});
