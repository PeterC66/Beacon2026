// beacon2/frontend/src/__tests__/MemberClassEditor.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemberClassEditor from '../pages/membership/MemberClassEditor.jsx';

const mcApi = {
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getMonthlyFees: vi.fn(),
  saveMonthlyFees: vi.fn(),
};
const settingsApi = { get: vi.fn() };

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useParams: () => ({ id: 'new' }), useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can: vi.fn().mockReturnValue(true),
    hasFeature: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  memberClasses: {
    get: (...a) => mcApi.get(...a),
    create: (...a) => mcApi.create(...a),
    update: (...a) => mcApi.update(...a),
    delete: (...a) => mcApi.delete(...a),
    getMonthlyFees: (...a) => mcApi.getMonthlyFees(...a),
    saveMonthlyFees: (...a) => mcApi.saveMonthlyFees(...a),
  },
  settings: { get: (...a) => settingsApi.get(...a) },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MemberClassEditor />
    </MemoryRouter>,
  );
}

describe('MemberClassEditor page (new class)', () => {
  beforeEach(() => {
    mcApi.get.mockReset().mockResolvedValue({});
    mcApi.create.mockReset().mockResolvedValue({});
    mcApi.update.mockReset().mockResolvedValue({});
    mcApi.getMonthlyFees.mockReset().mockResolvedValue([]);
    mcApi.saveMonthlyFees.mockReset().mockResolvedValue({});
    settingsApi.get
      .mockReset()
      .mockResolvedValue({ fee_variation: 'same_all_year', gift_aid_enabled: false });
  });

  it('renders without crashing', () => {
    const { container } = renderPage();
    expect(container).toBeTruthy();
  });

  it('shows the Add Membership Class heading', () => {
    renderPage();
    expect(screen.getByText('Add Membership Class')).toBeInTheDocument();
  });

  it('associates the class-name label with its input', () => {
    renderPage();
    expect(screen.getByLabelText('Class name')).toBeInTheDocument();
  });

  it('creates the class with the entered name and fee on submit', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Class name'), { target: { value: 'Concession' } });
    fireEvent.change(screen.getByLabelText('Fee per person (£)'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /save record/i }));

    await waitFor(() => expect(mcApi.create).toHaveBeenCalledTimes(1));
    expect(mcApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Concession', fee: 15 }),
    );
  });
});
