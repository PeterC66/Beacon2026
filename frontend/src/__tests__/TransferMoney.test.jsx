// beacon2/frontend/src/__tests__/TransferMoney.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TransferMoney from '../pages/finance/TransferMoney.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  finance: {
    listAccounts:  vi.fn().mockResolvedValue([]),
    listTransfers: vi.fn().mockResolvedValue([]),
  },
  requestBlob: vi.fn(),
}));

describe('TransferMoney page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><TransferMoney /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Transfer Money heading', () => {
    render(<MemoryRouter><TransferMoney /></MemoryRouter>);
    expect(screen.getByText('Transfer Money')).toBeTruthy();
  });
});
