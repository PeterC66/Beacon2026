// beacon2/frontend/src/__tests__/RecentMembers.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecentMembers from '../pages/members/RecentMembers.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tenant: 'test-u3a', can: vi.fn().mockReturnValue(true) }),
}));

vi.mock('../lib/api.js', () => ({
  members: { recent: vi.fn().mockResolvedValue([]), download: vi.fn().mockResolvedValue(undefined) },
  groups:  { list: vi.fn().mockResolvedValue([]), bulkAddMembers: vi.fn().mockResolvedValue({ added: 0, waitlisted: 0, skipped: 0 }) },
  polls:   { list: vi.fn().mockResolvedValue([]), addMembers: vi.fn().mockResolvedValue({ added: 0 }) },
}));

describe('RecentMembers page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><RecentMembers /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Recent Members heading', () => {
    const { getAllByText } = render(<MemoryRouter><RecentMembers /></MemoryRouter>);
    expect(getAllByText('Recent Members').length).toBeGreaterThan(0);
  });
});
