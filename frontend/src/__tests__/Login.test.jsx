// beacon2/frontend/src/__tests__/Login.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ login: vi.fn(), loading: false, error: null }),
}));

describe('Login page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><Login /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Administration heading', () => {
    const { getByText } = render(<MemoryRouter><Login /></MemoryRouter>);
    expect(getByText('Administration')).toBeInTheDocument();
  });

  it('shows the Enter button', () => {
    const { getByRole } = render(<MemoryRouter><Login /></MemoryRouter>);
    expect(getByRole('button', { name: /enter/i })).toBeInTheDocument();
  });
});
