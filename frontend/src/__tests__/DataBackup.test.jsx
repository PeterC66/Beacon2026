// beacon2/frontend/src/__tests__/DataBackup.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DataBackup from '../pages/misc/DataBackup.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tenant: 'test-u3a', can: vi.fn().mockReturnValue(true) }),
}));

vi.mock('../lib/api.js', () => ({
  backup: {
    export:  vi.fn().mockResolvedValue(undefined),
  },
}));

describe('DataBackup page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><DataBackup /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the page heading', () => {
    const { getAllByText } = render(<MemoryRouter><DataBackup /></MemoryRouter>);
    expect(getAllByText('Data Export & Backup').length).toBeGreaterThan(0);
  });

  it('shows all 7 individual export options', () => {
    const { getByText } = render(<MemoryRouter><DataBackup /></MemoryRouter>);
    expect(getByText('Members and addresses')).toBeInTheDocument();
    expect(getByText('Finance ledger with detail')).toBeInTheDocument();
    expect(getByText('Groups and teams, with members, venues and faculties')).toBeInTheDocument();
    expect(getByText('Calendar')).toBeInTheDocument();
    expect(getByText('System users, roles and privileges')).toBeInTheDocument();
    expect(getByText('u3a Officers')).toBeInTheDocument();
    expect(getByText('Site settings and set up')).toBeInTheDocument();
  });

  it('shows the Backup all data button', () => {
    const { getAllByText } = render(<MemoryRouter><DataBackup /></MemoryRouter>);
    expect(getAllByText('Backup all data').length).toBeGreaterThan(0);
  });
});
