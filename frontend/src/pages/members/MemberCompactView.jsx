// beacon2/frontend/src/pages/members/MemberCompactView.jsx
// Read-only condensed member view — experimental layout inspired by Beacon.
// Displays all member data on a single screen for laptop users,
// while remaining responsive on smaller screens.

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { members as membersApi, memberStatuses as statusApi, memberClasses as classApi, finance as financeApi, polls as pollsApi, settings as settingsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = d.getUTCDate();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(day).padStart(2, '0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

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

// Inline field: label beside value, compact
function Field({ label, value, className = '' }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={`flex items-baseline gap-1.5 min-w-0 ${className}`}>
      <span className="text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">{label}</span>
      <span className="text-sm text-slate-900 truncate">{value}</span>
    </div>
  );
}

// Full-width field for longer content
function FieldWide({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-baseline gap-1.5 min-w-0 col-span-full">
      <span className="text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">{label}</span>
      <span className="text-sm text-slate-900">{value}</span>
    </div>
  );
}

export default function MemberCompactView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, tenant } = useAuth();

  const [member, setMember]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [statuses, setStatuses]   = useState([]);
  const [classes, setClasses]     = useState([]);
  const [groups, setGroups]       = useState([]);
  const [txns, setTxns]           = useState([]);
  const [polls, setPolls]         = useState([]);
  const [memberPollIds, setMemberPollIds] = useState([]);
  const [cfLabels, setCfLabels]   = useState({ label1: '', label2: '', label3: '', label4: '' });
  const [partnerName, setPartnerName] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      membersApi.get(id),
      statusApi.list(),
      classApi.list(),
      membersApi.getGroups(id),
      financeApi.listTransactions({ memberId: id }),
      pollsApi.list(),
      settingsApi.getCustomFieldLabels(),
    ]).then(([m, sts, cls, grps, ts, pls, cfLbls]) => {
      setMember(m);
      setStatuses(sts);
      setClasses(cls);
      setGroups(grps);
      setTxns(ts);
      setPolls(pls);
      setMemberPollIds(m.poll_ids ?? []);
      setCfLabels(cfLbls);
      // Load partner name if linked
      if (m.partner_id) {
        membersApi.get(m.partner_id)
          .then((p) => setPartnerName(`${p.forenames} ${p.surname}`))
          .catch(() => {});
      }
    }).catch((err) => {
      setError(err.message || 'Failed to load member');
    }).finally(() => setLoading(false));
  }, [id]);

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Members List', to: '/members' },
    { label: 'Full Record', to: `/members/${id}` },
  ];

  if (loading) return (
    <div className="min-h-screen">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />
      <p className="text-center text-slate-500 mt-8">Loading…</p>
    </div>
  );

  if (error || !member) return (
    <div className="min-h-screen">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />
      <p className="text-center text-red-600 mt-8">{error || 'Member not found'}</p>
    </div>
  );

  const statusName = statuses.find((s) => s.id === member.status_id)?.name ?? '—';
  const className_ = classes.find((c) => c.id === member.class_id)?.name ?? '—';
  const fullName = [member.title, member.forenames, member.surname, member.suffix].filter(Boolean).join(' ');
  const knownAs = member.known_as;
  const memberNo = member.membership_number;

  // Build address string
  const addrParts = [member.house_no, member.street].filter(Boolean).join(' ');
  const addrLine2 = [member.add_line1, member.add_line2].filter(Boolean).join(', ');
  const addrLine3 = [member.town, member.county].filter(Boolean).join(', ');

  const memberPolls = polls.filter((p) => memberPollIds.includes(p.id));

  // Section styling
  const sectionCls = 'bg-white/90 rounded shadow-sm';
  const headerCls = 'text-xs font-semibold text-slate-600 uppercase tracking-wide bg-amber-100/80 px-3 py-1.5 rounded-t border-b border-amber-200/50';

  return (
    <div className="min-h-screen pb-6">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-6xl mx-auto px-3 py-3">
        {/* Title row */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-slate-800">
            Member Record — {fullName}
            {knownAs && <span className="text-slate-500 font-normal text-sm ml-2">({knownAs})</span>}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">No. {memberNo}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              statusName === 'Current' ? 'bg-green-100 text-green-700' :
              statusName === 'Lapsed' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-600'
            }`}>{statusName}</span>
          </div>
        </div>

        {/* Timestamps */}
        {member.created_at && (
          <p className="text-[11px] text-slate-400 mb-3">
            Created {fmtTimestamp(member.created_at)}
            {member.updated_at && member.updated_at !== member.created_at && `; last changed ${fmtTimestamp(member.updated_at)}`}
          </p>
        )}

        {/* Main grid: 2 columns on lg, single on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* ── Left column: Membership + Details ── */}
          <div className="space-y-3">

            {/* Membership */}
            <div className={sectionCls}>
              <h2 className={headerCls}>Membership</h2>
              <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
                <Field label="Class" value={className_} />
                <Field label="Joined" value={fmtDate(member.joined_on)} />
                <Field label="Next renewal" value={fmtDate(member.next_renewal)} />
                <Field label="Gift Aid from" value={member.gift_aid_from ? fmtDate(member.gift_aid_from) : null} />
                {member.initials && <Field label="Initials" value={member.initials} />}
              </div>
            </div>

            {/* Contact */}
            <div className={sectionCls}>
              <h2 className={headerCls}>Contact</h2>
              <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
                <Field label="Mobile" value={member.mobile} />
                <Field label="Email" value={member.email} className="col-span-2" />
                <Field label="Emergency" value={member.emergency_contact} className="col-span-2" />
                {member.hide_contact && (
                  <span className="text-[11px] text-amber-600 col-span-2">Contact hidden from group leaders</span>
                )}
              </div>
            </div>

            {/* Address */}
            <div className={sectionCls}>
              <div className="flex items-center justify-between">
                <h2 className={headerCls + ' flex-1'}>Address</h2>
                {partnerName && (
                  <span className="text-[11px] text-blue-600 px-3 py-1.5 bg-amber-100/80 rounded-t border-b border-amber-200/50">
                    Shared with {partnerName}
                  </span>
                )}
              </div>
              <div className="px-3 py-2 space-y-0.5">
                {addrParts && <p className="text-sm text-slate-900">{addrParts}</p>}
                {addrLine2 && <p className="text-sm text-slate-900">{addrLine2}</p>}
                {addrLine3 && <p className="text-sm text-slate-900">{addrLine3}</p>}
                {member.postcode && <p className="text-sm text-slate-900">{member.postcode}</p>}
                {member.telephone && (
                  <Field label="Home tel." value={member.telephone} />
                )}
              </div>
            </div>

            {/* Notes */}
            {member.notes && (
              <div className={sectionCls}>
                <h2 className={headerCls}>Notes</h2>
                <div className="px-3 py-2">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{member.notes}</p>
                </div>
              </div>
            )}

            {/* Polls */}
            {memberPolls.length > 0 && (
              <div className={sectionCls}>
                <h2 className={headerCls}>Polls</h2>
                <div className="px-3 py-2 flex flex-wrap gap-2">
                  {memberPolls.map((p) => (
                    <span key={p.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Fields */}
            {(cfLabels.label1 || cfLabels.label2 || cfLabels.label3 || cfLabels.label4) && (
              <div className={sectionCls}>
                <h2 className={headerCls}>Custom Fields</h2>
                <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {[1, 2, 3, 4].map((n) => {
                    const lbl = cfLabels[`label${n}`];
                    const val = member[`custom_field_${n}`];
                    if (!lbl) return null;
                    return <Field key={n} label={lbl} value={val || '—'} />;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column: Groups + Ledger ── */}
          <div className="space-y-3">

            {/* Groups */}
            <div className={sectionCls}>
              <h2 className={headerCls}>Groups</h2>
              {groups.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-3 py-2">No groups</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-200">
                        <th className="px-3 py-1.5 font-medium">Group</th>
                        <th className="px-3 py-1.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g, i) => (
                        <tr key={g.id} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-amber-50/50' : ''}`}>
                          <td className="px-3 py-1">
                            {can('group_records_all', 'view') ? (
                              <Link to={`/groups/${g.id}`} className="text-blue-700 hover:underline">{g.name}</Link>
                            ) : g.name}
                            {g.is_leader && <span className="ml-1 text-amber-500" title="Leader">★</span>}
                            {g.waiting_since && <span className="ml-1 text-slate-400" title="Waiting list">⏳</span>}
                          </td>
                          <td className="px-3 py-1">
                            {g.status === 'inactive'
                              ? <span className="text-red-600">Inactive</span>
                              : <span className="text-slate-500">Active</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Ledger */}
            {can('finance_ledger', 'view') && (
              <div className={sectionCls}>
                <h2 className={headerCls}>Ledger</h2>
                {txns.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-3 py-2">No transactions</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="px-2 py-1.5 font-medium">#</th>
                          <th className="px-2 py-1.5 font-medium">Date</th>
                          <th className="px-2 py-1.5 font-medium">Detail</th>
                          <th className="px-2 py-1.5 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txns.map((t, i) => (
                          <tr key={t.id} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-amber-50/50' : ''}`}>
                            <td className="px-2 py-1">
                              {can('finance_transactions', 'view') ? (
                                <Link to={`/finance/transactions/${t.id}`} className="text-blue-700 hover:underline font-mono">{t.transaction_number}</Link>
                              ) : (
                                <span className="font-mono">{t.transaction_number}</span>
                              )}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">{t.date ? fmtDate(t.date) : ''}</td>
                            <td className="px-2 py-1 max-w-[180px] truncate" title={t.detail}>{t.detail}</td>
                            <td className={`px-2 py-1 text-right font-medium ${t.type === 'in' ? 'text-green-700' : 'text-red-700'}`}>
                              {t.type === 'in' ? '' : '−'}£{Number(t.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-4">
          <Link to={`/members/${id}`}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors">
            Edit Member
          </Link>
          <Link to="/members"
            className="border border-slate-300 text-slate-600 hover:bg-slate-50 rounded px-4 py-1.5 text-sm transition-colors">
            Back to List
          </Link>
        </div>
      </div>
    </div>
  );
}
