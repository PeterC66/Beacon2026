// beacon2/frontend/src/__tests__/SystemMessages.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SystemMessages from '../pages/settings/SystemMessages.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tenant: 'test-u3a', can: vi.fn().mockReturnValue(true) }),
}));

vi.mock('../lib/api.js', () => ({
  systemMessages: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

describe('SystemMessages page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><SystemMessages /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the System Messages heading', () => {
    const { getAllByText } = render(<MemoryRouter><SystemMessages /></MemoryRouter>);
    expect(getAllByText('System Messages').length).toBeGreaterThan(0);
  });
});
