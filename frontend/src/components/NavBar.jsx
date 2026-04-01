// beacon2/frontend/src/components/NavBar.jsx
// Navigation bar: centred links separated by " – ".
// Each link: { label, to, disabled?, onClick? }
// When disabled is true, the label is shown as greyed-out non-clickable text.
// When onClick is provided (without to), renders as a button styled like a link.

import { Link } from 'react-router-dom';

export default function NavBar({ links }) {
  return (
    <nav className="text-center py-2 px-4 text-sm bg-white/60 backdrop-blur-sm border-y border-white/50">
      {links.map((link, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-2 text-slate-400">–</span>}
          {link.to && !link.disabled
            ? <Link to={link.to} className="text-blue-700 hover:underline">{link.label}</Link>
            : link.onClick && !link.disabled
              ? <button type="button" onClick={link.onClick} className="text-blue-700 hover:underline">{link.label}</button>
              : <span className={link.disabled ? 'text-slate-400' : 'text-slate-500'}>{link.label}</span>}
        </span>
      ))}
    </nav>
  );
}
