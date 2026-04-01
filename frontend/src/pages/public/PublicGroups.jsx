// beacon2/frontend/src/pages/public/PublicGroups.jsx
// Public (unauthenticated) groups list page.
// Visible to anyone with the URL. Fields controlled by group_info_config public flags.

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { publicApi } from '../../lib/api.js';

function formatTime(t) {
  if (!t) return '';
  const s = String(t);
  const idx = s.indexOf('T');
  if (idx !== -1) return s.slice(idx + 1, idx + 6);
  return s.slice(0, 5);
}

function GroupItem({ group }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="font-semibold text-slate-800">
          {expanded ? '\u25BC' : '\u25B6'}{' '}{group.name}
        </span>
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-2 text-sm">
          {group.when && (
            <div className="flex">
              <span className="w-32 text-right pr-3 text-slate-500 italic">When</span>
              <span>{group.when}</span>
            </div>
          )}
          {(group.startTime || group.endTime) && (
            <div className="flex">
              <span className="w-32 text-right pr-3 text-slate-500 italic">Normally meets</span>
              <span>
                {formatTime(group.startTime)}
                {group.endTime ? ` to ${formatTime(group.endTime)}` : ''}
              </span>
            </div>
          )}
          {group.venue && (
            <div className="flex">
              <span className="w-32 text-right pr-3 text-slate-500 italic">Venue</span>
              <span>{group.venue}</span>
            </div>
          )}
          {group.contact && (
            <div className="flex">
              <span className="w-32 text-right pr-3 text-slate-500 italic">Contact</span>
              <span>{group.contact}</span>
            </div>
          )}
          {group.enquiries && (
            <div className="flex">
              <span className="w-32 text-right pr-3 text-slate-500 italic">Enquiries</span>
              <span>{group.enquiries}</span>
            </div>
          )}
          {group.information && (
            <div className="flex">
              <span className="w-32 text-right pr-3 text-slate-500 italic">Information</span>
              <span>{group.information}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PublicGroups() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const hideHeader = searchParams.get('hdr') === '0';

  const [groups, setGroups] = useState([]);
  const [u3aName, setU3aName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await publicApi.getPublicGroups(slug);
        setGroups(data.groups || []);
        setU3aName(data.u3aName || slug);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <p className="text-slate-500">Loading groups...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {!hideHeader && (
          <h1 className="text-xl font-bold text-center text-slate-800 mb-6">
            {u3aName} — Groups
          </h1>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}

        <div className="space-y-1">
          {groups.map((g) => (
            <GroupItem key={g.id} group={g} />
          ))}
        </div>

        {groups.length === 0 && !error && (
          <p className="text-sm text-slate-500 text-center py-8">No groups are available.</p>
        )}
      </div>
    </div>
  );
}
