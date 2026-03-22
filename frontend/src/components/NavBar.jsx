// beacon2/frontend/src/components/NavBar.jsx
// Navigation bar: centred links separated by " – ".

import { Link } from 'react-router-dom';

export default function NavBar({ links }) {
  return (
    <nav className="text-center py-2 px-4 text-sm bg-white/60 backdrop-blur-sm border-y border-white/50">
      {links.map((link, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-2 text-slate-400">–</span>}
          {link.to
            ? <Link to={link.to} className="text-blue-700 hover:underline">{link.label}</Link>
            : <span className="text-slate-500">{link.label}</span>}
        </span>
      ))}
    </nav>
  );
}
