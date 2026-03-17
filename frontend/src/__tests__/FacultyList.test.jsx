// beacon2/frontend/src/__tests__/FacultyList.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FacultyList from '../pages/groups/FacultyList.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  faculties: { list: vi.fn().mockResolvedValue([]) },
}));

describe('FacultyList page', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter><FacultyList /></MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });

  it('shows Group Faculties heading', () => {
    const { getByText } = render(
      <MemoryRouter><FacultyList /></MemoryRouter>,
    );
    expect(getByText('Group Faculties')).toBeTruthy();
  });
});
