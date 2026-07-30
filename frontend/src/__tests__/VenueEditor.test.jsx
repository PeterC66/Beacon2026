// beacon2026/frontend/src/__tests__/VenueEditor.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VenueEditor from '../pages/groups/VenueEditor.jsx';

const venuesApi = {
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  venues: {
    get: (...a) => venuesApi.get(...a),
    create: (...a) => venuesApi.create(...a),
    update: (...a) => venuesApi.update(...a),
    delete: (...a) => venuesApi.delete(...a),
  },
}));

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/venues/new']}>
      <Routes>
        <Route path="/venues/new" element={<VenueEditor />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderExisting() {
  return render(
    <MemoryRouter initialEntries={['/venues/v1']}>
      <Routes>
        <Route path="/venues/:id" element={<VenueEditor />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('VenueEditor page — new venue', () => {
  beforeEach(() => {
    venuesApi.get.mockReset().mockResolvedValue({
      id: 'v1',
      name: 'Village Hall',
      contact: null,
      address: null,
      postcode: null,
      telephone: null,
      email: null,
      website: null,
      notes: null,
      private_address: false,
      accessible: false,
    });
    venuesApi.create.mockReset().mockResolvedValue({});
    venuesApi.update.mockReset().mockResolvedValue({});
    venuesApi.delete.mockReset().mockResolvedValue({});
  });

  it('renders without crashing', () => {
    const { container } = renderNew();
    expect(container).toBeTruthy();
  });

  it('shows Add New Venue heading', () => {
    renderNew();
    expect(screen.getByText('Add New Venue')).toBeTruthy();
  });

  it('associates the Venue label with its input', () => {
    renderNew();
    // Label association added in the accessibility sweep — getByLabelText works.
    expect(screen.getByLabelText(/Venue/)).toBeInTheDocument();
  });

  it('creates the venue with the entered details on submit', async () => {
    renderNew();
    fireEvent.change(screen.getByLabelText(/Venue/), { target: { value: 'Parish Rooms' } });
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'OX1 1AA' } });
    fireEvent.click(screen.getByRole('button', { name: /save record/i }));

    await waitFor(() => expect(venuesApi.create).toHaveBeenCalledTimes(1));
    expect(venuesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Parish Rooms', postcode: 'OX1 1AA' }),
    );
    expect(venuesApi.update).not.toHaveBeenCalled();
  });
});

describe('VenueEditor page — existing venue', () => {
  beforeEach(() => {
    venuesApi.get.mockReset().mockResolvedValue({
      id: 'v1',
      name: 'Village Hall',
      contact: null,
      address: null,
      postcode: null,
      telephone: null,
      email: null,
      website: null,
      notes: null,
      private_address: false,
      accessible: false,
    });
    venuesApi.create.mockReset().mockResolvedValue({});
    venuesApi.update.mockReset().mockResolvedValue({});
  });

  it('loads the venue and updates it on submit', async () => {
    renderExisting();
    expect(await screen.findByDisplayValue('Village Hall')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Venue/), { target: { value: 'Village Hall Annexe' } });
    fireEvent.click(screen.getByRole('button', { name: /save record/i }));

    await waitFor(() => expect(venuesApi.update).toHaveBeenCalledTimes(1));
    expect(venuesApi.update).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({ name: 'Village Hall Annexe' }),
    );
    expect(venuesApi.create).not.toHaveBeenCalled();
  });
});
