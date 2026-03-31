// Shared "record created / last changed" timestamp display.
// Usage:
//   <RecordTimestamp label="Group record" createdAt={g.created_at} updatedAt={g.updated_at} />
//   <RecordTimestamp label="Address record" createdAt={addr.created_at} updatedAt={addr.updated_at} className="mt-2" />

function fmtTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = d.getDate();
  const mon = months[d.getMonth()];
  const yr  = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, '0');
  const mm  = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${mon} ${yr} ${hh}:${mm}`;
}

export default function RecordTimestamp({ label, createdAt, updatedAt, className = '' }) {
  if (!createdAt) return null;
  const changed = updatedAt && updatedAt !== createdAt
    ? `; last changed ${fmtTimestamp(updatedAt)}`
    : '';
  return (
    <p className={`text-xs text-slate-500 text-center ${className}`}>
      {label} created {fmtTimestamp(createdAt)}{changed}
    </p>
  );
}
