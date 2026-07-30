// beacon2026/frontend/src/__tests__/RoleEditor.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RoleEditor from '../pages/roles/RoleEditor.jsx';

const rolesApi = { get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
const privsApi = { resources: vi.fn() };

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  roles: {
    get: (...a) => rolesApi.get(...a),
    create: (...a) => rolesApi.create(...a),
    update: (...a) => rolesApi.update(...a),
    delete: (...a) => rolesApi.delete(...a),
  },
  privileges: { resources: (...a) => privsApi.resources(...a) },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useParams: () => ({ id: 'new' }), useNavigate: () => vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <RoleEditor />
    </MemoryRouter>,
  );
}

describe('RoleEditor page (new role)', () => {
  beforeEach(() => {
    rolesApi.get
      .mockReset()
      .mockResolvedValue({ name: '', is_committee: false, notes: '', privileges: [] });
    rolesApi.create.mockReset().mockResolvedValue({ id: 'r1' });
    rolesApi.update.mockReset().mockResolvedValue({});
    privsApi.resources.mockReset().mockResolvedValue([]);
  });

  it('shows the Role Record heading', () => {
    renderPage();
    expect(screen.getByText('Role Record')).toBeInTheDocument();
  });

  it('associates the Name label with its input', async () => {
    renderPage();
    expect(await screen.findByLabelText(/^Name/)).toBeInTheDocument();
  });

  it('blocks saving and shows an error when the name is empty', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /save role/i }));
    expect(await screen.findByText('Role name is required.')).toBeInTheDocument();
    expect(rolesApi.create).not.toHaveBeenCalled();
  });

  it('creates the role with the entered name on save', async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Treasurer' } });
    fireEvent.click(screen.getByRole('button', { name: /save role/i }));

    await waitFor(() => expect(rolesApi.create).toHaveBeenCalledTimes(1));
    expect(rolesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Treasurer', isCommittee: false }),
    );
  });
});
