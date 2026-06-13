// Shared "record created / last changed" timestamp display.
// Usage:
//   <RecordTimestamp label="Group record" createdAt={g.created_at} updatedAt={g.updated_at} />
//   <RecordTimestamp label="Address record" createdAt={addr.created_at} updatedAt={addr.updated_at} className="mt-2" />

import { fmtTimestamp } from '../lib/dateFormatters.js';

export default function RecordTimestamp({ label, createdAt, updatedAt, className = '' }) {
  if (!createdAt) return null;
  const changed =
    updatedAt && updatedAt !== createdAt ? `; last changed ${fmtTimestamp(updatedAt)}` : '';
  return (
    <p className={`text-xs text-slate-500 text-center ${className}`}>
      {label} created {fmtTimestamp(createdAt)}
      {changed}
    </p>
  );
}
