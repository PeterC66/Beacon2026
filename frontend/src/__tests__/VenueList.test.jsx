// beacon2/frontend/src/__tests__/VenueList.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VenueList from '../pages/groups/VenueList.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  venues: { list: vi.fn().mockResolvedValue([]) },
}));

describe('VenueList page', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter><VenueList /></MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });

  it('shows Group Venues heading', () => {
    const { getByText } = render(
      <MemoryRouter><VenueList /></MemoryRouter>,
    );
    expect(getByText('Group Venues')).toBeTruthy();
  });
});
