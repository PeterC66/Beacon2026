// beacon2/frontend/src/pages/public/PortalGroups.jsx
// Members Portal — view interest groups, join/leave (doc 10.2.2).

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { portalApi } from '../../lib/api.js';

function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-4">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupItem({ group, onJoin, onLeave, submitting }) {
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
        {group.isMember && (
          <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
            MEMBER
          </span>
        )}
        {group.isWaiting && (
          <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
            WAITING
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-2 text-sm">
          {group.canJoin && !group.isMember && !group.isWaiting && (
            <div className="text-center mb-2">
              <button
                onClick={() => onJoin(group)}
                disabled={submitting}
                className="text-blue-700 hover:underline font-medium"
              >
                Join group
              </button>
            </div>
          )}
          {(group.isMember || group.isWaiting) && (
            <div className="text-center mb-2">
              <button
                onClick={() => onLeave(group)}
                disabled={submitting}
                className="text-blue-700 hover:underline font-medium"
              >
                Leave group
              </button>
            </div>
          )}

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

function formatTime(t) {
  if (!t) return '';
  const s = String(t);
  const idx = s.indexOf('T');
  if (idx !== -1) return s.slice(idx + 1, idx + 6);
  return s.slice(0, 5);
}

export default function PortalGroups() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(null); // { type: 'join'|'leave', group }
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    loadGroups();
  }, [slug]);

  async function loadGroups() {
    try {
      const data = await portalApi.getGroups(slug);
      setGroups(data);
    } catch (err) {
      if (err.message.includes('expired') || err.message.includes('401')) {
        navigate(`/public/${slug}/portal`, { replace: true });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleJoinClick(group) {
    setConfirm({
      type: 'join',
      group,
      title: 'Confirm',
      message: `Please confirm you wish to join ${group.name}\n\nThe leader will be informed of your application.`,
      confirmLabel: 'Join Group',
    });
  }

  function handleLeaveClick(group) {
    setConfirm({
      type: 'leave',
      group,
      title: 'Confirm',
      message: `Are you sure you wish to leave ${group.name}?`,
      confirmLabel: 'Leave Group',
    });
  }

  async function handleConfirm() {
    if (!confirm) return;
    setSubmitting(true);
    setFeedback('');
    try {
      let result;
      if (confirm.type === 'join') {
        result = await portalApi.joinGroup(slug, confirm.group.id);
      } else {
        result = await portalApi.leaveGroup(slug, confirm.group.id);
      }
      setFeedback(result.message);
      setConfirm(null);
      await loadGroups();
    } catch (err) {
      setFeedback(err.message);
      setConfirm(null);
    } finally {
      setSubmitting(false);
    }
  }

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
        <div className="flex items-center justify-between mb-4">
          <Link to={`/public/${slug}/portal/home`} className="text-sm text-blue-700 hover:underline">
            &larr; Members Portal
          </Link>
        </div>

        <h1 className="text-xl font-bold text-center text-slate-800 mb-6">
          u3a Groups
        </h1>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}

        {feedback && (
          <div className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-700 text-sm font-medium text-center mb-4">
            {feedback}
          </div>
        )}

        <div className="space-y-1">
          {groups.map((g) => (
            <GroupItem
              key={g.id}
              group={g}
              onJoin={handleJoinClick}
              onLeave={handleLeaveClick}
              submitting={submitting}
            />
          ))}
        </div>

        {groups.length === 0 && !error && (
          <p className="text-sm text-slate-500 text-center py-8">No groups are available.</p>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
