// beacon2/frontend/src/__tests__/Home.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../pages/Home.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user:   { name: 'Test User', email: 'test@test.com' },
    tenant: 'test-u3a',
    logout: vi.fn().mockResolvedValue(undefined),
    can:    vi.fn().mockReturnValue(true),
  }),
}));

describe('Home page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Administration heading', () => {
    const { getByText } = render(<MemoryRouter><Home /></MemoryRouter>);
    expect(getByText('Administration')).toBeInTheDocument();
  });

  it('shows the Log Out button', () => {
    const { getByText } = render(<MemoryRouter><Home /></MemoryRouter>);
    expect(getByText('Log Out')).toBeInTheDocument();
  });

  it('shows the Set up section', () => {
    const { getAllByText } = render(<MemoryRouter><Home /></MemoryRouter>);
    // Appears in both mobile and desktop layouts
    expect(getAllByText('Set up').length).toBeGreaterThan(0);
  });
});
