// beacon2/frontend/src/__tests__/PollList.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PollList from '../pages/admin/PollList.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tenant: 'test-u3a', can: vi.fn().mockReturnValue(true) }),
}));

vi.mock('../lib/api.js', () => ({
  polls: { list: vi.fn().mockResolvedValue([]) },
}));

describe('PollList page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><PollList /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Poll Set Up heading', () => {
    const { getByText } = render(<MemoryRouter><PollList /></MemoryRouter>);
    expect(getByText('Poll Set Up')).toBeInTheDocument();
  });
});
