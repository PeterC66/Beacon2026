// beacon2/frontend/src/__tests__/MembershipCards.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MembershipCards from '../pages/membership/MembershipCards.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  membershipCards: { list: vi.fn().mockResolvedValue([]) },
  polls:           { list: vi.fn().mockResolvedValue([]) },
}));

describe('MembershipCards page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><MembershipCards /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the page heading', () => {
    const { getAllByText } = render(<MemoryRouter><MembershipCards /></MemoryRouter>);
    expect(getAllByText('Membership Cards').length).toBeGreaterThan(0);
  });

  it('shows filter radio buttons', () => {
    const { getByText } = render(<MemoryRouter><MembershipCards /></MemoryRouter>);
    expect(getByText('Outstanding only (new members and renewals)')).toBeInTheDocument();
    expect(getByText('All current members')).toBeInTheDocument();
  });

  it('shows advance expiry checkbox', () => {
    const { getByText } = render(<MemoryRouter><MembershipCards /></MemoryRouter>);
    expect(getByText('Advance expiry to next membership year')).toBeInTheDocument();
  });
});
