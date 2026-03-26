// beacon2/frontend/src/components/GoToMemberButton.jsx
//
// Small "..." button that navigates to a member's record.
// Usage: <GoToMemberButton memberId={123} />

import { useNavigate } from 'react-router-dom';

export default function GoToMemberButton({ memberId, className = '' }) {
  const navigate = useNavigate();

  if (!memberId) return null;

  return (
    <button
      type="button"
      title="Go to member record"
      onClick={() => { navigate(`/members/${memberId}`); window.scrollTo(0, 0); }}
      className={`inline-flex items-center justify-center w-8 h-8 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:border-slate-400 text-sm font-bold leading-none ${className}`}
    >
      ...
    </button>
  );
}
