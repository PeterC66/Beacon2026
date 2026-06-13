// beacon2/frontend/src/__tests__/TransferMoney.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TransferMoney from '../pages/finance/TransferMoney.jsx';

const financeApi = {
  listAccounts: vi.fn(),
  listTransfers: vi.fn(),
  createTransfer: vi.fn(),
  updateTransfer: vi.fn(),
  deleteTransfer: vi.fn(),
};

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  finance: {
    listAccounts: (...a) => financeApi.listAccounts(...a),
    listTransfers: (...a) => financeApi.listTransfers(...a),
    createTransfer: (...a) => financeApi.createTransfer(...a),
    updateTransfer: (...a) => financeApi.updateTransfer(...a),
    deleteTransfer: (...a) => financeApi.deleteTransfer(...a),
  },
  requestBlob: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <TransferMoney />
    </MemoryRouter>,
  );
}

describe('TransferMoney page', () => {
  beforeEach(() => {
    financeApi.listAccounts.mockReset().mockResolvedValue([
      { id: 'a1', name: 'Current', active: true },
      { id: 'a2', name: 'Savings', active: true },
    ]);
    financeApi.listTransfers.mockReset().mockResolvedValue([]);
    financeApi.createTransfer.mockReset().mockResolvedValue({});
  });

  it('shows the Transfer Money heading', async () => {
    renderPage();
    expect(await screen.findByText('Transfer Money')).toBeInTheDocument();
  });

  it('validates that a positive amount is required', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }));
    expect(await screen.findByText('A positive amount is required.')).toBeInTheDocument();
    expect(financeApi.createTransfer).not.toHaveBeenCalled();
  });

  it('rejects a transfer between the same account', async () => {
    renderPage();
    await screen.findByLabelText(/Amount/);
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText(/From account/), { target: { value: 'a1' } });
    fireEvent.change(screen.getByLabelText(/To account/), { target: { value: 'a1' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText('From and To accounts must be different.')).toBeInTheDocument();
    expect(financeApi.createTransfer).not.toHaveBeenCalled();
  });

  it('creates a valid transfer', async () => {
    renderPage();
    await screen.findByLabelText(/Amount/);
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText(/From account/), { target: { value: 'a1' } });
    fireEvent.change(screen.getByLabelText(/To account/), { target: { value: 'a2' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(financeApi.createTransfer).toHaveBeenCalledTimes(1));
    expect(financeApi.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50, from_account_id: 'a1', to_account_id: 'a2' }),
    );
  });
});
