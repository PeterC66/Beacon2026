// beacon2/frontend/src/__tests__/UserList.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserList from '../pages/users/UserList.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  users: { list: vi.fn().mockResolvedValue([]) },
}));

describe('UserList page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><UserList /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the System Users heading', () => {
    const { getByText } = render(<MemoryRouter><UserList /></MemoryRouter>);
    expect(getByText('System Users')).toBeInTheDocument();
  });
});
