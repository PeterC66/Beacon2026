// beacon2/frontend/src/__tests__/RoleList.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RoleList from '../pages/roles/RoleList.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  roles: { list: vi.fn().mockResolvedValue([]) },
}));

describe('RoleList page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><RoleList /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the User Roles heading', () => {
    const { getByText } = render(<MemoryRouter><RoleList /></MemoryRouter>);
    expect(getByText('User Roles')).toBeInTheDocument();
  });
});
