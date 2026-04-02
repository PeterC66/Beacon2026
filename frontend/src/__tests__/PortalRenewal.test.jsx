// beacon2/frontend/src/__tests__/PortalRenewal.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PortalRenewal from '../pages/public/PortalRenewal.jsx';

vi.mock('../lib/api.js', () => ({
  portalApi: {
    getRenewalInfo: vi.fn().mockResolvedValue({
      u3aName: 'Test u3a',
      member: {
        id: 'm1', membershipNumber: 1001,
        forenames: 'Alice', surname: 'Smith', displayName: 'Alice',
        className: 'Individual', fee: 20,
        nextRenewal: '2026-01-01', giftAidFrom: null, isJoint: false,
      },
      partner: null,
      totalFee: 20,
      showGiftAid: false,
      onlineRenewEmail: '',
    }),
  },
}));

describe('PortalRenewal page', () => {
  it('renders without crashing', () => {
    // Simulate a logged-in portal session
    sessionStorage.setItem('portalToken', 'test-token');
    const { container } = render(
      <MemoryRouter initialEntries={['/public/test-u3a/portal/renewal']}>
        <Routes>
          <Route path="/public/:slug/portal/renewal" element={<PortalRenewal />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
    sessionStorage.removeItem('portalToken');
  });
});
