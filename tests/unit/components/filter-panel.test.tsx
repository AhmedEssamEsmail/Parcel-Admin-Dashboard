import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GlobalFilters } from '@/components/filters/global-filters';
import type { GlobalFilterState } from '@/lib/filters/serialize';

describe('GlobalFilters (Filter Panel)', () => {
  const mockFilters: GlobalFilterState = {
    warehouse: 'WH1',
    from: '2024-01-01',
    to: '2024-01-31',
  };

  it('should render filter inputs', () => {
    const onChange = vi.fn();
    const onApply = vi.fn();

    render(<GlobalFilters filters={mockFilters} onChange={onChange} onApply={onApply} />);

    expect(screen.getByLabelText(/Warehouse/)).toBeInTheDocument();
    expect(screen.getByLabelText(/From/)).toBeInTheDocument();
    expect(screen.getByLabelText(/To/)).toBeInTheDocument();
  });

  it('should handle warehouse selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onApply = vi.fn();

    render(<GlobalFilters filters={mockFilters} onChange={onChange} onApply={onApply} />);

    const warehouseSelect = screen.getByLabelText(/Warehouse/);
    await user.selectOptions(warehouseSelect, 'RIYADH');

    expect(onChange).toHaveBeenCalledWith({
      ...mockFilters,
      warehouse: 'RIYADH',
    });
  });

  it('should handle date range selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onApply = vi.fn();

    render(<GlobalFilters filters={mockFilters} onChange={onChange} onApply={onApply} />);

    const fromInput = screen.getByLabelText(/From/);
    await user.clear(fromInput);
    await user.type(fromInput, '2024-02-01');

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.warehouse).toBe('WH1');
    expect(lastCall.to).toBe('2024-01-31');
  });

  it('should handle apply button click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onApply = vi.fn();

    render(<GlobalFilters filters={mockFilters} onChange={onChange} onApply={onApply} />);

    const applyButton = screen.getByText('Apply');
    await user.click(applyButton);

    expect(onApply).toHaveBeenCalled();
  });

  it('should disable apply button when loading', () => {
    const onChange = vi.fn();
    const onApply = vi.fn();

    render(
      <GlobalFilters filters={mockFilters} loading={true} onChange={onChange} onApply={onApply} />
    );

    const applyButton = screen.getByText('Loading...');
    expect(applyButton).toBeDisabled();
  });

  it('should reset filters', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onApply = vi.fn();

    render(<GlobalFilters filters={mockFilters} onChange={onChange} onApply={onApply} />);

    const warehouseSelect = screen.getByLabelText(/Warehouse/);
    await user.selectOptions(warehouseSelect, 'ALL');

    expect(onChange).toHaveBeenCalledWith({
      ...mockFilters,
      warehouse: 'ALL',
    });
  });

  it('should include All Warehouses option by default', () => {
    const onChange = vi.fn();
    const onApply = vi.fn();

    render(<GlobalFilters filters={mockFilters} onChange={onChange} onApply={onApply} />);

    const warehouseSelect = screen.getByLabelText(/Warehouse/);
    expect(warehouseSelect).toHaveTextContent('All Warehouses');
  });

  it('should exclude All Warehouses option when includeAllWarehouses is false', () => {
    const onChange = vi.fn();
    const onApply = vi.fn();

    render(
      <GlobalFilters
        filters={mockFilters}
        includeAllWarehouses={false}
        onChange={onChange}
        onApply={onApply}
      />
    );

    const warehouseSelect = screen.getByLabelText(/Warehouse/);
    expect(warehouseSelect).not.toHaveTextContent('All Warehouses');
  });
});
