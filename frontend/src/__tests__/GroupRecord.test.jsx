// beacon2/frontend/src/__tests__/GroupRecord.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GroupRecord from '../pages/groups/GroupRecord.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  groups:    {
    get:          vi.fn().mockResolvedValue({ id: 'g1', name: 'Watercolour', status: 'active', faculty_id: null }),
    update:       vi.fn().mockResolvedValue({}),
    delete:       vi.fn().mockResolvedValue({}),
    listMembers:  vi.fn().mockResolvedValue([]),
    addMember:    vi.fn().mockResolvedValue({}),
    updateMember: vi.fn().mockResolvedValue({}),
    removeMember: vi.fn().mockResolvedValue({}),
    listEvents:   vi.fn().mockResolvedValue([]),
    createEvents: vi.fn().mockResolvedValue([]),
    updateEvent:  vi.fn().mockResolvedValue({}),
    deleteEvents: vi.fn().mockResolvedValue({}),
  },
  faculties: { list: vi.fn().mockResolvedValue([]) },
  members:   { list: vi.fn().mockResolvedValue([]) },
  venues:    { list: vi.fn().mockResolvedValue([]) },
}));

describe('GroupRecord page — new group', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/groups/new']}>
        <Routes>
          <Route path="/groups/new" element={<GroupRecord />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });

  it('shows Add New Group heading', () => {
    const { getAllByText } = render(
      <MemoryRouter initialEntries={['/groups/new']}>
        <Routes>
          <Route path="/groups/new" element={<GroupRecord />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(getAllByText('Add New Group').length).toBeGreaterThan(0);
  });
});

describe('GroupRecord page — existing group', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/groups/g1']}>
        <Routes>
          <Route path="/groups/:id" element={<GroupRecord />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });
});
