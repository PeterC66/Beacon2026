// beacon2/frontend/src/__tests__/EmailCompose.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmailCompose from '../pages/email/EmailCompose.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  email: {
    getFromAddresses:      vi.fn().mockResolvedValue([]),
    listStandardMessages:  vi.fn().mockResolvedValue([]),
    saveStandardMessage:   vi.fn().mockResolvedValue({}),
    deleteStandardMessage: vi.fn().mockResolvedValue(null),
    send:                  vi.fn().mockResolvedValue({ batchId: 'b1', sent: 0, failed: 0 }),
  },
  members: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

describe('EmailCompose page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><EmailCompose /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Send Email heading', () => {
    render(<MemoryRouter><EmailCompose /></MemoryRouter>);
    expect(screen.getByText('Send Email')).toBeTruthy();
  });
});
