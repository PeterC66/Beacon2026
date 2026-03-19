// beacon2/frontend/src/__tests__/GroupsStatement.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GroupsStatement from '../pages/finance/GroupsStatement.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  finance: {
    getGroupsStatement: vi.fn().mockResolvedValue({ groups: [], entries: null }),
  },
  requestBlob: vi.fn(),
}));

describe('GroupsStatement page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><GroupsStatement /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Groups Statement heading', () => {
    render(<MemoryRouter><GroupsStatement /></MemoryRouter>);
    expect(screen.getByText('Groups Statement')).toBeTruthy();
  });
});
