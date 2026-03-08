// beacon2/frontend/src/__tests__/MemberList.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemberList from '../pages/members/MemberList.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  members:       { list: vi.fn().mockResolvedValue([]) },
  memberStatuses: { list: vi.fn().mockResolvedValue([]) },
  memberClasses:  { list: vi.fn().mockResolvedValue([]) },
}));

describe('MemberList page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><MemberList /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Members heading', () => {
    const { getByText } = render(<MemoryRouter><MemberList /></MemoryRouter>);
    expect(getByText('Members')).toBeInTheDocument();
  });
});
