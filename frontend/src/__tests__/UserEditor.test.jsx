// beacon2/frontend/src/__tests__/UserEditor.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserEditor from '../pages/users/UserEditor.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  users: {
    get: vi.fn().mockResolvedValue({ name: '', email: '', username: '', active: true, is_site_admin: false, member_id: '', member_name: '', roles: [] }),
    availableMembers: vi.fn().mockResolvedValue([]),
  },
  roles: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useParams: () => ({ id: 'new' }), useNavigate: () => vi.fn() };
});

describe('UserEditor page (new user)', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><UserEditor /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Add New User heading', async () => {
    render(<MemoryRouter><UserEditor /></MemoryRouter>);
    expect(await screen.findByText('Add New User')).toBeInTheDocument();
  });
});
