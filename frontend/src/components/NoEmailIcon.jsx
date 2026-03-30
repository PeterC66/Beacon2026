// Small "no email" indicator — envelope with a red diagonal strike.
// Shown next to members who have no email address on file.

export default function NoEmailIcon({ className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 16"
      className={`inline-block w-4 h-3 ${className}`}
      aria-label="No email address"
      role="img"
    >
      {/* Envelope body */}
      <rect x="1" y="2" width="18" height="12" rx="1.5" fill="#fef9c3" stroke="#94a3b8" strokeWidth="1" />
      {/* Envelope flap */}
      <polyline points="1,2 10,9 19,2" fill="none" stroke="#94a3b8" strokeWidth="1" strokeLinejoin="round" />
      {/* Red strike-through */}
      <line x1="2" y1="14" x2="18" y2="2" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
