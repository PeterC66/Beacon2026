// beacon2/frontend/src/__tests__/FinanceLedger.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FinanceLedger from '../pages/finance/FinanceLedger.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  finance: {
    listAccounts:     vi.fn().mockResolvedValue([]),
    listCategories:   vi.fn().mockResolvedValue([]),
    listTransactions: vi.fn().mockResolvedValue([]),
  },
  groups: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

describe('FinanceLedger page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><FinanceLedger /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Financial Ledger heading', () => {
    render(<MemoryRouter><FinanceLedger /></MemoryRouter>);
    expect(screen.getByText('Financial Ledger')).toBeTruthy();
  });
});
