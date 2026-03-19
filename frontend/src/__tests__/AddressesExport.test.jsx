// beacon2/frontend/src/__tests__/AddressesExport.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddressesExport from '../pages/members/AddressesExport.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  addressExport:   { list: vi.fn().mockResolvedValue([]) },
  memberStatuses:  { list: vi.fn().mockResolvedValue([]) },
  memberClasses:   { list: vi.fn().mockResolvedValue([]) },
  polls:           { list: vi.fn().mockResolvedValue([]) },
  groups:          { list: vi.fn().mockResolvedValue([]) },
  requestBlob:     vi.fn().mockResolvedValue(undefined),
}));

describe('AddressesExport page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><AddressesExport /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the page heading', () => {
    const { getAllByText } = render(<MemoryRouter><AddressesExport /></MemoryRouter>);
    expect(getAllByText('Addresses Export').length).toBeGreaterThan(0);
  });

  it('shows format options', () => {
    const { getByText } = render(<MemoryRouter><AddressesExport /></MemoryRouter>);
    expect(getByText('Third Age Matters (TAM)')).toBeInTheDocument();
    expect(getByText('Labels (PDF)')).toBeInTheDocument();
    expect(getByText('Excel')).toBeInTheDocument();
    expect(getByText('CSV')).toBeInTheDocument();
    expect(getByText('TSV')).toBeInTheDocument();
  });

  it('shows filters section', () => {
    const { getByText } = render(<MemoryRouter><AddressesExport /></MemoryRouter>);
    expect(getByText('Filters')).toBeInTheDocument();
    expect(getByText('Status')).toBeInTheDocument();
    expect(getByText('Class')).toBeInTheDocument();
    expect(getByText('Poll')).toBeInTheDocument();
    expect(getByText('Group')).toBeInTheDocument();
  });

  it('shows Select all / Deselect all controls', () => {
    const { getAllByText } = render(<MemoryRouter><AddressesExport /></MemoryRouter>);
    expect(getAllByText('Select all').length).toBeGreaterThan(0);
    expect(getAllByText('Deselect all').length).toBeGreaterThan(0);
  });
});
