// beacon2/frontend/src/__tests__/MemberClassList.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemberClassList from '../pages/membership/MemberClassList.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  memberClasses: { list: vi.fn().mockResolvedValue([]) },
}));

describe('MemberClassList page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><MemberClassList /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Membership Classes heading', () => {
    const { getByText } = render(<MemoryRouter><MemberClassList /></MemoryRouter>);
    expect(getByText('Membership Classes')).toBeInTheDocument();
  });
});
