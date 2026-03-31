// beacon2/frontend/src/__tests__/VenueEditor.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VenueEditor from '../pages/groups/VenueEditor.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  venues: {
    get:    vi.fn().mockResolvedValue({ id: 'v1', name: 'Village Hall', contact: null, address: null, postcode: null, telephone: null, email: null, website: null, notes: null, private_address: false, accessible: false }),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

describe('VenueEditor page — new venue', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/venues/new']}>
        <Routes>
          <Route path="/venues/new" element={<VenueEditor />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });

  it('shows Add New Venue heading', () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={['/venues/new']}>
        <Routes>
          <Route path="/venues/new" element={<VenueEditor />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(getByText('Add New Venue')).toBeTruthy();
  });
});

describe('VenueEditor page — existing venue', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/venues/v1']}>
        <Routes>
          <Route path="/venues/:id" element={<VenueEditor />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });
});
