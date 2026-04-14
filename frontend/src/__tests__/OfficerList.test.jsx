// beacon2/frontend/src/__tests__/OfficerList.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OfficerList from '../pages/officers/OfficerList.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tenant: 'test-u3a', can: vi.fn().mockReturnValue(true) }),
}));

vi.mock('../lib/api.js', () => ({
  offices: {
    list:        vi.fn().mockResolvedValue([]),
    listMembers: vi.fn().mockResolvedValue([]),
  },
}));

describe('OfficerList page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><OfficerList /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the u3a Offices heading', () => {
    const { getByText } = render(<MemoryRouter><OfficerList /></MemoryRouter>);
    expect(getByText('u3a Offices and Post Holders')).toBeInTheDocument();
  });
});
