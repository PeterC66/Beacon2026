// beacon2/frontend/src/__tests__/SystemSettings.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SystemSettings from '../pages/settings/SystemSettings.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  settings: {
    get: vi.fn().mockResolvedValue({
      card_colour:               '#0066cc',
      email_cards:               false,
      public_phone:              null,
      public_email:              null,
      home_page:                 null,
      online_join_email:         null,
      online_renew_email:        null,
      fee_variation:             'same_all_year',
      extended_membership_month: null,
      advance_renewals_weeks:    4,
      grace_lapse_weeks:         4,
      deletion_years:            7,
      default_payment_method:    'Cheque',
      gift_aid_enabled:          false,
      gift_aid_online_renewals:  false,
      default_town:              null,
      default_county:            null,
      default_std_code:          null,
      paypal_email:              null,
      paypal_cancel_url:         null,
      shared_address_warning:    false,
    }),
    update: vi.fn().mockResolvedValue({}),
  },
}));

describe('SystemSettings page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><SystemSettings /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the System Settings heading', () => {
    render(<MemoryRouter><SystemSettings /></MemoryRouter>);
    const headings = screen.getAllByText('System Settings');
    expect(headings.length).toBeGreaterThan(0);
  });
});
