// beacon2/frontend/src/__tests__/PublicLinks.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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
      onlineJoiningEnabled: false,
      privacyPolicyUrl: '',
      paypalEmail: '',
      tenantSlug: 'test-u3a',
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
});
