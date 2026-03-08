import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CsvPreview } from '@/components/upload/csv-preview';
import type { CsvRow } from '@/lib/ingest/types';

describe('CsvPreview (Upload Form)', () => {
  const mockValidData: CsvRow[] = [
    {
      parcel_id: 'P001',
      order_date: '2024-01-01',
      zone: 'Z1',
      city: 'City1',
    } as CsvRow,
    {
      parcel_id: 'P002',
      order_date: '2024-01-02',
      zone: 'Z2',
      city: 'City2',
    } as CsvRow,
  ];

  const mockDataWithWarnings: CsvRow[] = [
    {
      parcel_id: 'P001',
      order_date: '2024-01-01',
      zone: '',
      city: '',
    } as CsvRow,
  ];

  const mockDataWithErrors: CsvRow[] = [
    {
      parcel_id: '',
      order_date: '',
      zone: 'Z1',
      city: 'City1',
    } as CsvRow,
  ];

  it('should render file selection and validation summary', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <CsvPreview
        data={mockValidData}
        filename="test.csv"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText(/CSV Preview - test.csv/)).toBeInTheDocument();
    expect(screen.getByText(/Valid: 2 rows ready to import/)).toBeInTheDocument();
  });

  it('should handle form submission with valid data', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <CsvPreview
        data={mockValidData}
        filename="test.csv"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const proceedButton = screen.getByText(/Proceed with 2 rows/);
    await user.click(proceedButton);

    expect(onConfirm).toHaveBeenCalledWith(mockValidData);
  });

  it('should display validation warnings', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <CsvPreview
        data={mockDataWithWarnings}
        filename="test.csv"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText(/Warnings: 2 rows/)).toBeInTheDocument();

    const warningsButton = screen.getByText(/Warnings \(2\)/);
    await user.click(warningsButton);

    await waitFor(() => {
      expect(screen.getByText(/Missing zone/)).toBeInTheDocument();
    });
  });

  it('should display validation errors and disable proceed button', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <CsvPreview
        data={mockDataWithErrors}
        filename="test.csv"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText(/Errors: 2 rows/)).toBeInTheDocument();

    const errorsButton = screen.getByText(/Errors \(2\)/);
    await user.click(errorsButton);

    await waitFor(() => {
      expect(screen.getByText(/Missing parcel_id/)).toBeInTheDocument();
    });

    const proceedButton = screen.getByText(/Proceed with 0 rows/);
    expect(proceedButton).toBeDisabled();
  });

  it('should handle cancel action', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <CsvPreview
        data={mockValidData}
        filename="test.csv"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
