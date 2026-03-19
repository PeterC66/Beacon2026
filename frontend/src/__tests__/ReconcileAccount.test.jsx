// beacon2/frontend/src/__tests__/ReconcileAccount.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReconcileAccount from '../pages/finance/ReconcileAccount.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  finance: {
    listAccounts:    vi.fn().mockResolvedValue([]),
    getReconcileData: vi.fn().mockResolvedValue({ account: {}, clearedBalance: 0, uncleared: [] }),
    reconcile:       vi.fn().mockResolvedValue({}),
  },
}));

describe('ReconcileAccount page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><ReconcileAccount /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Reconcile Account heading', () => {
    render(<MemoryRouter><ReconcileAccount /></MemoryRouter>);
    expect(screen.getByText('Reconcile Account')).toBeTruthy();
  });
});
