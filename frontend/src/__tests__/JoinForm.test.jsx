// beacon2/frontend/src/__tests__/JoinForm.test.jsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JoinForm from '../pages/public/JoinForm.jsx';

const publicApi = { getJoinConfig: vi.fn(), submitJoin: vi.fn() };

vi.mock('../lib/api.js', () => ({
  publicApi: {
    getJoinConfig: (...a) => publicApi.getJoinConfig(...a),
    submitJoin: (...a) => publicApi.submitJoin(...a),
  },
}));

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/public/test-u3a/join']}>
      <Routes>
        <Route path="/public/:slug/join" element={<JoinForm />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('JoinForm page', () => {
  beforeEach(() => {
    publicApi.getJoinConfig.mockReset().mockResolvedValue({
      u3aName: 'Test u3a',
      privacyPolicyUrl: 'https://example.com/privacy',
      giftAidEnabled: true,
      defaultTown: 'Oxford',
      defaultCounty: 'Oxon',
      classes: [{ id: 'c1', name: 'Individual', fee: 20, explanation: '', is_joint: false }],
    });
    publicApi.submitJoin.mockReset().mockResolvedValue({ ok: true });
  });

  it('renders the join heading once config has loaded', async () => {
    renderForm();
    expect(await screen.findByText('Join Test u3a')).toBeInTheDocument();
  });

  it('shows validation errors and does not submit when required fields are empty', async () => {
    renderForm();
    // Wait for the form to load (single class is auto-selected).
    await screen.findByText('Join Test u3a');
    fireEvent.click(screen.getByRole('button', { name: /make payment/i }));

    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    expect(screen.getByText('Surname is required.')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(publicApi.submitJoin).not.toHaveBeenCalled();
  });

  it('surfaces an unavailable-joining message when config fails to load', async () => {
    publicApi.getJoinConfig.mockRejectedValueOnce(new Error('Online joining is not enabled.'));
    renderForm();
    expect(await screen.findByText('Online Joining Unavailable')).toBeInTheDocument();
  });
});
