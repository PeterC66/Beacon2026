// beacon2/frontend/src/__tests__/SystemDashboard.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SystemDashboard from '../pages/system/SystemDashboard.jsx';

vi.mock('../lib/api.js', () => ({
  system: {
    listTenants:     vi.fn().mockResolvedValue([]),
    createTenant:    vi.fn(),
    setTenantActive: vi.fn(),
    getSettings:     vi.fn().mockResolvedValue({ systemMessage: '' }),
  },
  getSysToken:   vi.fn().mockReturnValue('fake-sys-token'),
  clearSysToken: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => vi.fn() };
});

describe('SystemDashboard page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><SystemDashboard /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows Beacon2 / System Admin heading', () => {
    const { getByText } = render(<MemoryRouter><SystemDashboard /></MemoryRouter>);
    expect(getByText(/System Admin/)).toBeInTheDocument();
  });
});
