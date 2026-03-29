// beacon2/frontend/src/__tests__/GroupList.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GroupList from '../pages/groups/GroupList.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  groups:    { list: vi.fn().mockResolvedValue([]) },
  faculties: { list: vi.fn().mockResolvedValue([]) },
  polls:     { list: vi.fn().mockResolvedValue([]) },
}));

describe('GroupList page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><GroupList /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Groups heading', () => {
    const { getByText } = render(<MemoryRouter><GroupList /></MemoryRouter>);
    expect(getByText('Groups')).toBeInTheDocument();
  });
});
