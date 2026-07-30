// beacon2026/frontend/src/lib/routes.js
// Frequently cross-referenced route paths used as navigation targets in
// multiple files (navigate(...) / <Link to=...>). Only the paths that recur
// across several pages are hoisted here — the full route table lives in
// App.jsx, which stays the single source of truth for the router itself.

export const ROUTES = {
  HOME: '/',
  EMAIL_COMPOSE: '/email/compose',
  LETTERS_COMPOSE: '/letters/compose',
  FINANCE_ACCOUNTS: '/finance/accounts',
  MEMBERS: '/members',
};
