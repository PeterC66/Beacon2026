// beacon2/frontend/src/__tests__/NonRenewals.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NonRenewals from '../pages/membership/NonRenewals.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tenant: 'test-u3a', can: vi.fn().mockReturnValue(true) }),
}));

vi.mock('../lib/api.js', () => ({
  members: {
    listNonRenewals: vi.fn().mockResolvedValue({
      members: [],
      mode: 'this_year',
      yearStart: '2026-01-01',
      graceLapse: 4,
      deletionYears: 7,
    }),
  },
}));

describe('NonRenewals page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><NonRenewals /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Non-renewals heading', () => {
    const { getAllByText } = render(<MemoryRouter><NonRenewals /></MemoryRouter>);
    expect(getAllByText('Non-renewals').length).toBeGreaterThan(0);
  });
});
