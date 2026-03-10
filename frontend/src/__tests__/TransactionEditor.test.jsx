// beacon2/frontend/src/__tests__/TransactionEditor.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TransactionEditor from '../pages/finance/TransactionEditor.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  finance: {
    listAccounts:      vi.fn().mockResolvedValue([]),
    listCategories:    vi.fn().mockResolvedValue([]),
    getTransaction:    vi.fn().mockResolvedValue(null),
    createTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
  },
  groups: {
    list: vi.fn().mockResolvedValue([]),
  },
  members: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useParams:       () => ({ id: 'new' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useNavigate:     () => vi.fn(),
  };
});

describe('TransactionEditor page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><TransactionEditor /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Add Transaction heading', () => {
    render(<MemoryRouter><TransactionEditor /></MemoryRouter>);
    expect(screen.getByText('Add Transaction')).toBeTruthy();
  });
});
