// beacon2/frontend/src/__tests__/FinancialStatement.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FinancialStatement from '../pages/finance/FinancialStatement.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  finance: {
    listAccounts: vi.fn().mockResolvedValue([]),
    getStatement: vi.fn().mockResolvedValue({
      yearNum: 2026, yearStart: '2026-01-01', yearEnd: '2026-12-31',
      accountLabel: 'All Accounts', openingBalance: 0,
      totalIn: 0, totalOut: 0, closingBalance: 0, categoryRows: [],
    }),
  },
  requestBlob: vi.fn(),
}));

describe('FinancialStatement page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><FinancialStatement /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Financial Statement heading', () => {
    render(<MemoryRouter><FinancialStatement /></MemoryRouter>);
    expect(screen.getByText('Financial Statement')).toBeTruthy();
  });
});
