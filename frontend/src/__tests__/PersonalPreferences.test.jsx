// beacon2/frontend/src/__tests__/PersonalPreferences.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PersonalPreferences from '../pages/settings/PersonalPreferences.jsx';

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tenant: 'test-u3a', can: vi.fn().mockReturnValue(true) }),
}));

vi.mock('../lib/api.js', () => ({
  auth: {
    getQA:          vi.fn().mockResolvedValue({ question: '' }),
    changePassword: vi.fn().mockResolvedValue({}),
    updateQA:       vi.fn().mockResolvedValue({}),
  },
}));

describe('PersonalPreferences page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><PersonalPreferences /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Personal Preferences heading', () => {
    const { getByText } = render(<MemoryRouter><PersonalPreferences /></MemoryRouter>);
    expect(getByText('Personal Preferences')).toBeInTheDocument();
  });

  it('shows the Change Password section', () => {
    const { getAllByText } = render(<MemoryRouter><PersonalPreferences /></MemoryRouter>);
    expect(getAllByText('Change Password').length).toBeGreaterThan(0);
  });

  it('shows the Security Q&A section', () => {
    const { getByText } = render(<MemoryRouter><PersonalPreferences /></MemoryRouter>);
    expect(getByText('Change Personal Q&A')).toBeInTheDocument();
  });

  it('shows the Display Preferences section', () => {
    const { getByText } = render(<MemoryRouter><PersonalPreferences /></MemoryRouter>);
    expect(getByText('Display Preferences')).toBeInTheDocument();
  });

  it('shows text size and colour theme radio options', () => {
    const { getByText } = render(<MemoryRouter><PersonalPreferences /></MemoryRouter>);
    expect(getByText('Text size')).toBeInTheDocument();
    expect(getByText('Colour theme')).toBeInTheDocument();
    expect(getByText('Normal')).toBeInTheDocument();
    expect(getByText('High Contrast')).toBeInTheDocument();
  });
});
