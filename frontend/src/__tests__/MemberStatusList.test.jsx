// beacon2/frontend/src/__tests__/MemberStatusList.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemberStatusList from '../pages/membership/MemberStatusList.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  memberStatuses: { list: vi.fn().mockResolvedValue([]) },
}));

describe('MemberStatusList page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><MemberStatusList /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Member Statuses heading', () => {
    const { getByText } = render(<MemoryRouter><MemberStatusList /></MemoryRouter>);
    expect(getByText('Member Statuses')).toBeInTheDocument();
  });
});
