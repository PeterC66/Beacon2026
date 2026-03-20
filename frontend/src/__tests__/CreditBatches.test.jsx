// beacon2/frontend/src/__tests__/CreditBatches.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreditBatches from '../pages/finance/CreditBatches.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  finance: {
    listAccounts:    vi.fn().mockResolvedValue([{ id: 'a1', name: 'Current Account', active: true }]),
    listBatches:     vi.fn().mockResolvedValue([]),
    getBatch:        vi.fn().mockResolvedValue({ id: 'b1', batch_ref: 'Batch-001', transactions: [] }),
    getUnbatched:    vi.fn().mockResolvedValue([]),
    createBatch:     vi.fn(),
    addToBatch:      vi.fn(),
    removeFromBatch: vi.fn(),
    deleteBatch:     vi.fn(),
  },
}));

describe('CreditBatches page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><CreditBatches /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Credit Batches heading', () => {
    render(<MemoryRouter><CreditBatches /></MemoryRouter>);
    expect(screen.getByText('Credit Batches')).toBeTruthy();
  });
});
