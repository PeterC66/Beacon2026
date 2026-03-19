// beacon2/frontend/src/__tests__/EmailUnblocker.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmailUnblocker from '../pages/email/EmailUnblocker.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  email: {
    unblock: vi.fn().mockResolvedValue({ message: 'Unblocked.' }),
  },
}));

describe('EmailUnblocker page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><EmailUnblocker /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Email Unblocker heading', () => {
    render(<MemoryRouter><EmailUnblocker /></MemoryRouter>);
    expect(screen.getByText('Email Unblocker')).toBeTruthy();
  });
});
