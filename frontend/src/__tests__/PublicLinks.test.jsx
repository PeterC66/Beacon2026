// beacon2/frontend/src/__tests__/PublicLinks.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicLinks from '../pages/misc/PublicLinks.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tenant: 'test-u3a', can: vi.fn().mockReturnValue(true) }),
}));

vi.mock('../lib/api.js', () => ({
  publicLinks: {
    get: vi.fn().mockResolvedValue({
      privacyPolicyUrl: '',
      paypalEmail: '',
      tenantSlug: 'test-u3a',
      portalConfig: { renewals: false, groups: false, calendar: false, personalDetails: false, replacementCard: false },
      groupInfoConfig: { status: { members: false, public: false } },
      calendarConfig: { venue: { members: false, public: false } },
    }),
  },
}));

describe('PublicLinks page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><PublicLinks /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Public Links heading', () => {
    const { getAllByText } = render(<MemoryRouter><PublicLinks /></MemoryRouter>);
    expect(getAllByText('Public Links').length).toBeGreaterThan(0);
  });

  it('shows all five configuration sections', async () => {
    const { getByText } = render(<MemoryRouter><PublicLinks /></MemoryRouter>);
    await waitFor(() => {
      expect(getByText('Member Services')).toBeInTheDocument();
      expect(getByText('Public Information')).toBeInTheDocument();
      expect(getByText('Configure Members Portal')).toBeInTheDocument();
      expect(getByText('Configure Group Information')).toBeInTheDocument();
      expect(getByText('Configure Calendar')).toBeInTheDocument();
    });
  });

  it('shows portal config options', async () => {
    const { getByText } = render(<MemoryRouter><PublicLinks /></MemoryRouter>);
    await waitFor(() => {
      expect(getByText('Membership renewals')).toBeInTheDocument();
      expect(getByText('Groups')).toBeInTheDocument();
      expect(getByText('Change Personal Details')).toBeInTheDocument();
      expect(getByText('Email Replacement membership card')).toBeInTheDocument();
    });
  });

  it('shows public information URLs', async () => {
    const { getByDisplayValue } = render(<MemoryRouter><PublicLinks /></MemoryRouter>);
    await waitFor(() => {
      expect(getByDisplayValue(/\/public\/test-u3a\/groups$/)).toBeInTheDocument();
      expect(getByDisplayValue(/\/public\/test-u3a\/calendar$/)).toBeInTheDocument();
    });
  });
});
