import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname, useRouter } from 'next/navigation';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AppNav } from '@/components/layout/nav';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

describe('AppNav (Navigation)', () => {
  const mockPush = vi.fn();
  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    } as never);
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  it('should render navigation links', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard');

    render(<AppNav />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('City Performance')).toBeInTheDocument();
    expect(screen.getByText('Exceptions')).toBeInTheDocument();
    expect(screen.getByText('Promise Reliability')).toBeInTheDocument();
    expect(screen.getByText('Route Efficiency')).toBeInTheDocument();
  });

  it('should highlight active link', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard');

    render(<AppNav />);

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveClass('active');
  });

  it('should not highlight inactive links', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard');

    render(<AppNav />);

    const exceptionsLink = screen.getByText('Exceptions').closest('a');
    expect(exceptionsLink).not.toHaveClass('active');
  });

  it('should handle logout action', async () => {
    const user = userEvent.setup();
    vi.mocked(usePathname).mockReturnValue('/dashboard');

    render(<AppNav />);

    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);

    expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
    });
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('should normalize settings path', () => {
    vi.mocked(usePathname).mockReturnValue('/settings/profile');

    render(<AppNav />);

    const settingsLink = screen.getByText('Settings').closest('a');
    expect(settingsLink).toHaveClass('active');
  });

  it('should render brand name', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard');

    render(<AppNav />);

    expect(screen.getByText('Parcel Admin Dashboard')).toBeInTheDocument();
  });

  it('should preserve query parameters in navigation links', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard');

    // Mock window.location.search
    Object.defineProperty(window, 'location', {
      value: {
        search: '?warehouse=WH1&from=2024-01-01&to=2024-01-31',
      },
      writable: true,
    });

    render(<AppNav />);

    const exceptionsLink = screen.getByText('Exceptions').closest('a');
    expect(exceptionsLink?.getAttribute('href')).toContain('warehouse=WH1');
    expect(exceptionsLink?.getAttribute('href')).toContain('from=2024-01-01');
    expect(exceptionsLink?.getAttribute('href')).toContain('to=2024-01-31');
  });
});
