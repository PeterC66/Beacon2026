// beacon2/frontend/src/__tests__/AuditLog.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuditLog from '../pages/misc/AuditLog.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tenant: 'test-u3a', can: vi.fn().mockReturnValue(true) }),
}));

vi.mock('../lib/api.js', () => ({
  audit: { list: vi.fn().mockResolvedValue([]) },
}));

describe('AuditLog page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><AuditLog /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Audit Log heading', () => {
    const { getByText } = render(<MemoryRouter><AuditLog /></MemoryRouter>);
    expect(getByText('Audit Log')).toBeInTheDocument();
  });
});
