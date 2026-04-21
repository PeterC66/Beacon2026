// beacon2/frontend/src/__tests__/MemberEditor.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemberEditor from '../pages/members/MemberEditor.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useParams: () => ({ id: 'new' }), useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
    hasFeature: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  members:       { get: vi.fn().mockResolvedValue({}), list: vi.fn().mockResolvedValue([]), validate: vi.fn().mockResolvedValue([]), getGroups: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  memberStatuses: { list: vi.fn().mockResolvedValue([]) },
  memberClasses:  { list: vi.fn().mockResolvedValue([]) },
  finance:        { listAccounts: vi.fn().mockResolvedValue([]), listTransactions: vi.fn().mockResolvedValue([]), getPaymentMethodDefaults: vi.fn().mockResolvedValue({ defaultMethod: '', mappings: {} }) },
  polls:          { list: vi.fn().mockResolvedValue([]), setForMember: vi.fn() },
  settings:       { get: vi.fn().mockResolvedValue({ shared_address_warning: false }), getYearConfig: vi.fn().mockResolvedValue({ yearStartMonth: 1, yearStartDay: 1, extendedMembershipMonth: null }), getNewMemberDefaults: vi.fn().mockResolvedValue({ defaultTown: '', defaultCounty: '', defaultStdCode: '' }), getCustomFieldLabels: vi.fn().mockResolvedValue({ label1: '', label2: '', label3: '', label4: '' }) },
}));

describe('MemberEditor page (new member)', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><MemberEditor /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Add New Member heading', () => {
    const { getByText } = render(<MemoryRouter><MemberEditor /></MemoryRouter>);
    expect(getByText('Add New Member')).toBeInTheDocument();
  });
});
