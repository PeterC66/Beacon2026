// beacon2/frontend/src/__tests__/MemberStatistics.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemberStatistics from '../pages/members/MemberStatistics.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tenant: 'test-u3a', can: vi.fn().mockReturnValue(true) }),
}));

vi.mock('../lib/api.js', () => ({
  members: {
    statistics: vi.fn().mockResolvedValue({
      yearStart: '2026-01-01',
      advanceRenewalsWeeks: 4,
      graceLapseWeeks: 4,
      currentNotRenewed: 0,
      lapsedCount: 0,
      totalCurrent: 0,
      classStats: [],
      activeGroups: 0,
      avgGroupMembers: 0,
      membersNotInGroup: 0,
      renewStats: [],
      renewFrom: '2026-01-01',
      renewTo: '2026-03-19',
    }),
  },
}));

describe('MemberStatistics page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><MemberStatistics /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Statistics heading', () => {
    const { getByText } = render(<MemoryRouter><MemberStatistics /></MemoryRouter>);
    expect(getByText('Membership Statistics')).toBeInTheDocument();
  });
});
