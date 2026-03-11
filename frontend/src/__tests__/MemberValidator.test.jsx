// beacon2/frontend/src/__tests__/MemberValidator.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemberValidator from '../pages/admin/MemberValidator.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  members: {
    validate: vi.fn().mockResolvedValue([]),
  },
}));

describe('MemberValidator page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><MemberValidator /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Validate Member Data heading', () => {
    const { getByText } = render(<MemoryRouter><MemberValidator /></MemoryRouter>);
    expect(getByText('Validate Member Data')).toBeInTheDocument();
  });
});
