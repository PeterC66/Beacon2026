// beacon2/frontend/src/__tests__/FinanceAccounts.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FinanceAccounts from '../pages/finance/FinanceAccounts.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  finance: {
    listAccounts:  vi.fn().mockResolvedValue([]),
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
  },
}));

describe('FinanceAccounts page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><FinanceAccounts /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Finance Accounts heading', () => {
    render(<MemoryRouter><FinanceAccounts /></MemoryRouter>);
    expect(screen.getByText('Finance Accounts')).toBeTruthy();
  });
});
