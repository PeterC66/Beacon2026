// beacon2026/frontend/src/__tests__/testUtils.jsx
//
// Shared test helpers for frontend component/page tests, to cut the
// render-wrapping boilerplate repeated across the suite.
//
// NOTE: `vi.mock(...)` calls cannot be centralised here — Vitest hoists them to
// the top of each test file and they are scoped per module path. These helpers
// cover the *rendering* boilerplate (router wrapping) and provide plain factory
// objects (e.g. `authValue`) that a test's own `vi.mock` factory can spread.

import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * Render `ui` inside a MemoryRouter. Pass `route` to set the initial URL.
 *   renderWithRouter(<RoleList />);
 *   renderWithRouter(<MemberList />, { route: '/members?status=current' });
 */
export function renderWithRouter(ui, { route = '/' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

/**
 * Render `ui` for a single parameterised route — the common pattern for editor
 * pages that read `useParams()`.
 *   renderAtRoute(<VenueEditor />, { path: '/venues/:id', route: '/venues/v1' });
 */
export function renderAtRoute(ui, { path, route }) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * Default auth-context value for `vi.mock('../context/AuthContext.jsx', ...)`.
 * Spread it and override per test:
 *   useAuth: () => authValue({ can: () => false })
 */
export function authValue(overrides = {}) {
  return {
    tenant: 'test-u3a',
    user: { id: 'u1', name: 'Test User' },
    can: () => true,
    hasFeature: () => true,
    login: () => {},
    logout: () => {},
    ...overrides,
  };
}
