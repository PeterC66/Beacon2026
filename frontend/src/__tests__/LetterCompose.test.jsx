// beacon2/frontend/src/__tests__/LetterCompose.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LetterCompose from '../pages/letters/LetterCompose.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tenant: 'test-u3a',
    can:    vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../lib/api.js', () => ({
  letters: {
    listStandardLetters:  vi.fn().mockResolvedValue([]),
    saveStandardLetter:   vi.fn().mockResolvedValue({}),
    deleteStandardLetter: vi.fn().mockResolvedValue(null),
    download:             vi.fn().mockResolvedValue(null),
  },
  members: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

describe('LetterCompose page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><LetterCompose /></MemoryRouter>);
    expect(container).toBeTruthy();
  });

  it('shows the Compose Letter heading', () => {
    render(<MemoryRouter><LetterCompose /></MemoryRouter>);
    expect(screen.getAllByText('Compose Letter').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the token panel', () => {
    render(<MemoryRouter><LetterCompose /></MemoryRouter>);
    expect(screen.getByText('Tokens — click to insert')).toBeTruthy();
  });

  it('shows the recipients section', () => {
    render(<MemoryRouter><LetterCompose /></MemoryRouter>);
    expect(screen.getByText(/Recipients/)).toBeTruthy();
  });
});
