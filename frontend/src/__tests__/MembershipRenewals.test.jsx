// beacon2/frontend/src/__tests__/MembershipRenewals.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MembershipRenewals from '../pages/membership/MembershipRenewals.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tenant: 'test-u3a', can: vi.fn().mockReturnValue(true) }),
}));

vi.mock('../lib/api.js', () => ({
  members: {
    listRenewals: vi.fn().mockResolvedValue({
      members: [],
      yearStart: '2026-01-01',
      prevYearStart: '2025-01-01',
      nextYearStart: '2027-01-01',
      showNextYear: false,
    }),
  },
  finance: {
    listAccounts: vi.fn().mockResolvedValue([]),
  },
  polls: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

describe('MembershipRenewals page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><MembershipRenewals /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Membership Renewals heading', () => {
    const { getAllByText } = render(<MemoryRouter><MembershipRenewals /></MemoryRouter>);
    expect(getAllByText('Membership Renewals').length).toBeGreaterThan(0);
  });
});
