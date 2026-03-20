// beacon2/frontend/src/__tests__/PortalLogin.test.jsx

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PortalLogin from '../pages/public/PortalLogin.jsx';

vi.mock('../lib/api.js', () => ({
  publicApi: {
    portalLogin: vi.fn(),
  },
}));

describe('PortalLogin page', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/public/test-u3a/portal']}>
        <Routes>
          <Route path="/public/:slug/portal" element={<PortalLogin />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });

  it('shows the Members Portal heading', () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={['/public/test-u3a/portal']}>
        <Routes>
          <Route path="/public/:slug/portal" element={<PortalLogin />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(getByText('Members Portal')).toBeInTheDocument();
  });
});
