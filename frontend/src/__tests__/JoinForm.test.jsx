// beacon2/frontend/src/__tests__/JoinForm.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JoinForm from '../pages/public/JoinForm.jsx';

vi.mock('../lib/api.js', () => ({
  publicApi: {
    getJoinConfig: vi.fn().mockResolvedValue({
      u3aName: 'Test u3a',
      privacyPolicyUrl: 'https://example.com/privacy',
      giftAidEnabled: true,
      defaultTown: 'Oxford',
      defaultCounty: 'Oxon',
      classes: [{ id: 'c1', name: 'Individual', fee: 20, explanation: '' }],
    }),
  },
}));

describe('JoinForm page', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/public/test-u3a/join']}>
        <Routes>
          <Route path="/public/:slug/join" element={<JoinForm />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });
});
