// beacon2026/frontend/src/__tests__/UserEditor.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserEditor from '../pages/users/UserEditor.jsx';

const usersApi = {
  get: vi.fn(),
  availableMembers: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
  setTempPassword: vi.fn(),
};
const rolesApi = { list: vi.fn() };

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  users: {
    get: (...a) => usersApi.get(...a),
    availableMembers: (...a) => usersApi.availableMembers(...a),
    create: (...a) => usersApi.create(...a),
    update: (...a) => usersApi.update(...a),
    assignRole: (...a) => usersApi.assignRole(...a),
    removeRole: (...a) => usersApi.removeRole(...a),
    setTempPassword: (...a) => usersApi.setTempPassword(...a),
  },
  roles: { list: (...a) => rolesApi.list(...a) },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useParams: () => ({ id: 'new' }), useNavigate: () => vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <UserEditor />
    </MemoryRouter>,
  );
}

describe('UserEditor page (new user)', () => {
  beforeEach(() => {
    usersApi.get.mockReset().mockResolvedValue({});
    usersApi.availableMembers
      .mockReset()
      .mockResolvedValue([{ id: 'm1', surname: 'Bloggs', forenames: 'Joe', email: 'joe@x.com' }]);
    usersApi.create.mockReset().mockResolvedValue({ id: 'u9', tempPassword: 'Temp123!' });
    rolesApi.list.mockReset().mockResolvedValue([]);
  });

  it('shows the Add New User heading', async () => {
    renderPage();
    expect(await screen.findByText('Add New User')).toBeInTheDocument();
  });

  it('requires a member to be selected before saving', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /save user/i }));
    expect(await screen.findByText('Please select a member.')).toBeInTheDocument();
    expect(usersApi.create).not.toHaveBeenCalled();
  });

  it('creates the user and shows the temporary-password notice', async () => {
    renderPage();
    // Member dropdown is populated from availableMembers once loaded.
    fireEvent.change(await screen.findByLabelText('Member'), { target: { value: 'm1' } });
    fireEvent.change(screen.getByLabelText(/Login name/), { target: { value: 'jbloggs' } });
    fireEvent.click(screen.getByRole('button', { name: /save user/i }));

    await waitFor(() => expect(usersApi.create).toHaveBeenCalledTimes(1));
    expect(usersApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'm1', username: 'jbloggs' }),
    );
    expect(await screen.findByText(/temporary password of Temp123!/)).toBeInTheDocument();
  });
});
