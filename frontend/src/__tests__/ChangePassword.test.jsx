// beacon2026/frontend/src/__tests__/ChangePassword.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChangePassword from '../pages/ChangePassword.jsx';

const forceChangePassword = vi.fn();
const clearMustChangePassword = vi.fn();
const navigate = vi.fn();

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { name: 'Jane Admin' },
    clearMustChangePassword,
    logout: vi.fn(),
  }),
}));

vi.mock('../lib/api.js', () => ({
  auth: { forceChangePassword: (...args) => forceChangePassword(...args) },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigate };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ChangePassword />
    </MemoryRouter>,
  );
}

describe('ChangePassword page', () => {
  beforeEach(() => {
    forceChangePassword.mockReset().mockResolvedValue({});
    clearMustChangePassword.mockReset();
    navigate.mockReset();
  });

  it('greets the user by name', () => {
    renderPage();
    expect(screen.getByText('Change password for Jane Admin')).toBeInTheDocument();
  });

  it('keeps Submit disabled until the form is valid', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('shows complexity feedback for a weak password', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    expect(screen.getByText(/At least 10 characters/)).toBeInTheDocument();
  });

  it('confirms when the password meets requirements', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Goodpass123' } });
    expect(screen.getByText('Password meets requirements')).toBeInTheDocument();
  });

  it('reports when the confirmation matches', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Goodpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm'), { target: { value: 'Goodpass123' } });
    expect(screen.getByText('Passwords match')).toBeInTheDocument();
  });

  it('submits the new password, security Q&A and navigates home', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Goodpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm'), { target: { value: 'Goodpass123' } });
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'Greendale' } });

    const submit = screen.getByRole('button', { name: /submit/i });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    await waitFor(() => expect(forceChangePassword).toHaveBeenCalled());
    expect(forceChangePassword).toHaveBeenCalledWith(
      'Goodpass123',
      'Your first school',
      'Greendale',
    );
    await waitFor(() => expect(clearMustChangePassword).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('surfaces an API error and does not navigate', async () => {
    forceChangePassword.mockRejectedValueOnce(new Error('Server rejected password'));
    renderPage();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Goodpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm'), { target: { value: 'Goodpass123' } });
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'Greendale' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText('Server rejected password')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
