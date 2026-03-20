// beacon2/frontend/src/__tests__/GiftAidDeclaration.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GiftAidDeclaration from '../pages/finance/GiftAidDeclaration.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  giftAid: {
    list: vi.fn().mockResolvedValue({
      enabled: true,
      rows: [
        {
          id: 't1', transaction_number: 1, date: '2026-03-01',
          gift_aid_amount: 25.00, gift_aid_claimed_at: null,
          member_id: 'm1', title: 'Mr', forenames: 'John', surname: 'Smith',
          membership_number: 101, gift_aid_from: '2025-01-01', email: 'john@test.com',
          house_no: '42', postcode: 'CB1 1AA',
        },
      ],
      yearNum: 2026,
      yearStart: '2026-01-01',
      yearEnd: '2026-12-31',
      startMonth: 1,
      startDay: 1,
    }),
    download: vi.fn(),
    mark: vi.fn(),
  },
  requestBlob: vi.fn(),
}));

describe('GiftAidDeclaration page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><GiftAidDeclaration /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Gift Aid Declaration heading', async () => {
    render(<MemoryRouter><GiftAidDeclaration /></MemoryRouter>);
    expect(screen.getByText('Gift Aid Declaration')).toBeTruthy();
  });
});
