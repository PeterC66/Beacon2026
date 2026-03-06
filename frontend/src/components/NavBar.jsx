// beacon2/frontend/src/components/NavBar.jsx
// Shared navigation bar rendered at the top (and optionally bottom) of each page.
// Pass `links` as an array of { label, to? } objects.
// Items without `to` are rendered as plain text (current page indicator).

import { Link } from 'react-router-dom';

export default function NavBar({ links }) {
  return (
    <nav className="text-center py-2 text-sm text-blue-600">
      {links.map((link, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-2 text-slate-400">–</span>}
          {link.to ? (
            <Link to={link.to} className="hover:underline">
              {link.label}
            </Link>
          ) : (
            <span className="text-slate-600">{link.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
