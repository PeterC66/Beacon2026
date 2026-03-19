// beacon2/frontend/src/__tests__/EmailDeliveryDetail.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmailDeliveryDetail from '../pages/email/EmailDeliveryDetail.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  email: {
    getDelivery: vi.fn().mockResolvedValue({
      batch: { id: 'b1', subject: 'Test', from_email: 'a@b.com', reply_to: 'a@b.com', recipient_count: 1, sent_at: new Date().toISOString() },
      recipients: [],
    }),
    refreshDelivery: vi.fn().mockResolvedValue({ updated: 0, recipients: [] }),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useParams: () => ({ id: 'b1' }) };
});

describe('EmailDeliveryDetail page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><EmailDeliveryDetail /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Email Delivery Detail heading', () => {
    render(<MemoryRouter><EmailDeliveryDetail /></MemoryRouter>);
    expect(screen.getByText('Email Delivery Detail')).toBeTruthy();
  });
});
