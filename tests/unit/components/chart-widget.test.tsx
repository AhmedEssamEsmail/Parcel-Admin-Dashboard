import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DwellTrendChart } from '@/components/charts/dwell-trend';

describe('DwellTrendChart (Chart Widget)', () => {
  const mockData = [
    { day: '2024-01-01', avg_delivery_minutes: 120 },
    { day: '2024-01-02', avg_delivery_minutes: 135 },
    { day: '2024-01-03', avg_delivery_minutes: 110 },
  ];

  it('should render chart with data', () => {
    const { container } = render(<DwellTrendChart rows={mockData} />);

    const chartWrapper = container.querySelector('.chart-wrapper');
    expect(chartWrapper).toBeInTheDocument();

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('should handle empty data', () => {
    const { container } = render(<DwellTrendChart rows={[]} />);

    const chartWrapper = container.querySelector('.chart-wrapper');
    expect(chartWrapper).toBeInTheDocument();

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('should handle null values in data', () => {
    const dataWithNulls = [
      { day: '2024-01-01', avg_delivery_minutes: 120 },
      { day: '2024-01-02', avg_delivery_minutes: null },
      { day: '2024-01-03', avg_delivery_minutes: 110 },
    ];

    const { container } = render(<DwellTrendChart rows={dataWithNulls} />);

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('should render with single data point', () => {
    const singleDataPoint = [{ day: '2024-01-01', avg_delivery_minutes: 120 }];

    const { container } = render(<DwellTrendChart rows={singleDataPoint} />);

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });
});
