// beacon2/frontend/src/__tests__/Login.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login.jsx';

const login = vi.fn();
const navigate = vi.fn();
let authError = null;

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ login, loading: false, error: authError }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigate };
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe('Login page', () => {
  beforeEach(() => {
    login.mockReset();
    navigate.mockReset();
    authError = null;
  });

  it('shows the Administration heading', () => {
    renderLogin();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('shows the Enter button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument();
  });

  it('submits the entered credentials and navigates home on success', async () => {
    login.mockResolvedValue(true);
    renderLogin();

    fireEvent.change(screen.getByLabelText('u3a'), { target: { value: 'oxford-u3a' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'jadmin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /enter/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('oxford-u3a', 'jadmin', 'secret123'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
  });

  it('does not navigate when login fails', async () => {
    login.mockResolvedValue(false);
    renderLogin();

    fireEvent.change(screen.getByLabelText('u3a'), { target: { value: 'oxford-u3a' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'jadmin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /enter/i }));

    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reveals the password when the show-password toggle is clicked', () => {
    renderLogin();
    const pw = screen.getByLabelText('Password');
    expect(pw).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByTitle('Show password'));
    expect(pw).toHaveAttribute('type', 'text');
  });

  it('opens the credential-recovery section on request', () => {
    renderLogin();
    expect(screen.queryByText('Recover your credentials')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /click here/i }));
    expect(screen.getByText('Recover your credentials')).toBeInTheDocument();
  });

  it('renders the login error banner when auth reports an error', () => {
    authError = 'bad';
    renderLogin();
    expect(screen.getByText(/login credentials are not recognised/i)).toBeInTheDocument();
  });
});
