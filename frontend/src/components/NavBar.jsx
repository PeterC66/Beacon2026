// beacon2/frontend/src/components/NavBar.jsx
// Beacon-style navigation bar: centred blue links separated by " - ".

import { Link } from 'react-router-dom';

export default function NavBar({ links }) {
  return (
    <nav className="b-nav">
      {links.map((link, i) => (
        <span key={i}>
          {i > 0 && <span className="b-nav-sep"> - </span>}
          {link.to ? (
            <Link to={link.to}>{link.label}</Link>
          ) : (
            <span style={{ color: '#444' }}>{link.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
