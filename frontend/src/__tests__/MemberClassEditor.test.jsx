// beacon2/frontend/src/__tests__/MemberClassEditor.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemberClassEditor from '../pages/membership/MemberClassEditor.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useParams: () => ({ id: 'new' }), useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  memberClasses: {
    get:    vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

describe('MemberClassEditor page (new class)', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><MemberClassEditor /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Add Membership Class heading', () => {
    const { getByText } = render(<MemoryRouter><MemberClassEditor /></MemoryRouter>);
    expect(getByText('Add Membership Class')).toBeInTheDocument();
  });
});
