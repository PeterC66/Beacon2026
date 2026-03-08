// beacon2/frontend/src/__tests__/SystemLogin.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SystemLogin from '../pages/system/SystemLogin.jsx';

vi.mock('../lib/api.js', () => ({
  system: { login: vi.fn() },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => vi.fn() };
});

describe('SystemLogin page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><SystemLogin /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows a Sign in button', () => {
    const { getByRole } = render(<MemoryRouter><SystemLogin /></MemoryRouter>);
    expect(getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
