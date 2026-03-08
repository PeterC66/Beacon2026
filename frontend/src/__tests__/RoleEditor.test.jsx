// beacon2/frontend/src/__tests__/RoleEditor.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RoleEditor from '../pages/roles/RoleEditor.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  roles:      { get: vi.fn().mockResolvedValue({ name: '', is_committee: false, notes: '', privileges: [] }) },
  privileges: { resources: vi.fn().mockResolvedValue([]) },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useParams: () => ({ id: 'new' }), useNavigate: () => vi.fn() };
});

describe('RoleEditor page (new role)', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><RoleEditor /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Role Record heading', () => {
    const { getByText } = render(<MemoryRouter><RoleEditor /></MemoryRouter>);
    expect(getByText('Role Record')).toBeInTheDocument();
  });
});
