// beacon2/frontend/src/__tests__/FinanceCategories.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FinanceCategories from '../pages/finance/FinanceCategories.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  finance: {
    listCategories:  vi.fn().mockResolvedValue([]),
    createCategory:  vi.fn(),
    updateCategory:  vi.fn(),
    deleteCategory:  vi.fn(),
  },
}));

describe('FinanceCategories page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><FinanceCategories /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Finance Categories heading', () => {
    render(<MemoryRouter><FinanceCategories /></MemoryRouter>);
    expect(screen.getByText('Finance Categories')).toBeTruthy();
  });
});
