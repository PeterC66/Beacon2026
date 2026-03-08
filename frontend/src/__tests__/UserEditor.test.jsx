// beacon2/frontend/src/__tests__/UserEditor.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserEditor from '../pages/users/UserEditor.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  users: { get: vi.fn().mockResolvedValue({ name: '', email: '', active: true, roles: [] }) },
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

  it('shows the Add User heading', () => {
    const { getByText } = render(<MemoryRouter><UserEditor /></MemoryRouter>);
    expect(getByText('Add User')).toBeInTheDocument();
  });
});
