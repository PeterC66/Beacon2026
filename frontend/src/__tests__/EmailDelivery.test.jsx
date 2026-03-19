// beacon2/frontend/src/__tests__/EmailDelivery.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmailDelivery from '../pages/email/EmailDelivery.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  email: {
    listDelivery: vi.fn().mockResolvedValue([]),
  },
}));

describe('EmailDelivery page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><EmailDelivery /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Email Delivery heading', () => {
    render(<MemoryRouter><EmailDelivery /></MemoryRouter>);
    expect(screen.getByText('Email Delivery')).toBeTruthy();
  });
});
