// beacon2/frontend/src/pages/membership/MembershipRenewals.jsx
// Doc 4.5 — Membership Renewals

import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { members as membersApi, finance as financeApi, polls as pollsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';

const PAYMENT_METHODS = ['Cash', 'Cheque', 'Standing Order', 'Direct Debit', 'Online', 'Other'];

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}
function fmtAmount(n) {
  if (n == null || n === '') return '—';
  return `£${Number(n).toFixed(2)}`;
}

export default function MembershipRenewals() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();

  const [data,      setData]      = useState(null);   // { members, yearStart, prevYearStart, nextYearStart, showNextYear }
  const [accounts,  setAccounts]  = useState([]);
  const [polls,     setPolls]     = useState([]);
  const payDefaults               = useRef({ defaultMethod: '', mappings: {} });
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const tableRef = useRef(null);

  // Renewal form state
  const [period,        setPeriod]        = useState('current_year');
  const [accountId,     setAccountId]     = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cheque');
  const [received,      setReceived]      = useState({});   // memberId → amount string
  const [giftAid,       setGiftAid]       = useState({});   // memberId → bool
  const [selected,      setSelected]      = useState(new Set());
  const [action,        setAction]        = useState('renew');
  const [chosenPoll,    setChosenPoll]    = useState('');

  // Status
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result,     setResult]     = useState(null);  // { renewed, errors }
  const [actionMsg,  setActionMsg]  = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [renewalData, accs, pollList, defaults] = await Promise.all([
        membersApi.listRenewals(),
        financeApi.listAccounts(),
        pollsApi.list(),
        financeApi.getPaymentMethodDefaults().catch(() => ({ defaultMethod: '', mappings: {} })),
      ]);
      setData(renewalData);
      const activeAccs = accs.filter((a) => a.active);
      setAccounts(activeAccs);
      payDefaults.current = defaults;
      // Use default payment method if configured, otherwise 'Cheque'
      const defMethod = defaults.defaultMethod || 'Cheque';
      setPaymentMethod(defMethod);
      // Use mapped account for the default method, otherwise first active account
      const mappedAccId = defaults.mappings[defMethod];
      if (mappedAccId && activeAccs.some((a) => a.id === mappedAccId)) {
        setAccountId(mappedAccId);
      } else if (activeAccs.length > 0) {
        setAccountId(activeAccs[0].id);
      }
      setPolls(pollList);
      if (pollList.length > 0) setChosenPoll(pollList[0].id);

      // Initialise received amounts + gift aid from member data
      const rcv = {};
      const ga  = {};
      for (const m of renewalData.members) {
        const fee = m.fee ?? 0;
        rcv[m.id] = String(Number(fee).toFixed(2));
        ga[m.id]  = Boolean(m.gift_aid_from);
      }
      setReceived(rcv);
      setGiftAid(ga);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filter members by period
  const filtered = useMemo(() => {
    if (!data) return [];
    const { members: mems, yearStart, prevYearStart, nextYearStart } = data;
    return mems.filter((m) => {
      const nr = m.next_renewal ? String(m.next_renewal).slice(0, 10) : null;
      if (period === 'next_year') {
        // Already renewed for current year but not next → next_renewal in [nextYearStart, nextNextYearStart)
        const nextNext = nextYearStart ? nextYearStart.slice(0, 4)
          ? (Number(nextYearStart.slice(0, 4)) + 1) + nextYearStart.slice(4)
          : null : null;
        return nr && nr >= nextYearStart && (!nextNext || nr < nextNext);
      }
      if (period === 'current_year') {
        return nr && nr >= prevYearStart && nr < nextYearStart;
      }
      // previous_years
      return !nr || nr < prevYearStart;
    });
  }, [data, period]);

  function toggleAll(checked) {
    if (checked) setSelected(new Set(filtered.map((m) => m.id)));
    else         setSelected(new Set());
  }
  function toggleOne(id, checked) {
    const s = new Set(selected);
    if (checked) s.add(id); else s.delete(id);
    setSelected(s);
  }

  async function handleDoWithSelected(e) {
    e.preventDefault();
    if (selected.size === 0) { setActionMsg({ type: 'error', text: 'No members selected.' }); return; }
    if (action === 'send_email') {
      sessionStorage.setItem('emailComposeMemberIds', JSON.stringify([...selected]));
      navigate('/email/compose');
      return;
    }
    if (action === 'send_letter') {
      sessionStorage.setItem('letterComposeMemberIds', JSON.stringify([...selected]));
      navigate('/letters/compose');
      return;
    }
    if (action === 'add_to_poll') {
      if (!chosenPoll) { setActionMsg({ type: 'error', text: 'Select a poll first.' }); return; }
      setProcessing(true);
      setActionMsg(null);
      try {
        await pollsApi.addMembers(chosenPoll, [...selected]);
        setActionMsg({ type: 'success', text: `${selected.size} member${selected.size !== 1 ? 's' : ''} added to poll.` });
      } catch (err) {
        setActionMsg({ type: 'error', text: err.message });
      } finally {
        setProcessing(false);
      }
      return;
    }
    // renew
    if (!accountId) { setActionMsg({ type: 'error', text: 'Select a finance account.' }); return; }
    setConfirming(true);
  }

  async function handleConfirmRenew() {
    setConfirming(false);
    setProcessing(true);
    setResult(null);
    setActionMsg(null);
    try {
      const amounts = {};
      const giftAidChanges = {};
      const origGa = {};
      for (const m of data.members) origGa[m.id] = Boolean(m.gift_aid_from);

      for (const id of selected) {
        amounts[id] = Number(received[id] ?? 0);
        if (giftAid[id] !== origGa[id]) giftAidChanges[id] = giftAid[id];
      }

      const res = await membersApi.renew({
        memberIds:      [...selected],
        accountId,
        paymentMethod,
        amounts,
        giftAidChanges,
        yearStart: data.yearStart,
      });
      setResult(res);
      // Reload to reflect renewed members
      await load();
      setSelected(new Set());
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setProcessing(false);
    }
  }

  const allChecked = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

  const INPUT  = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const SELECT = INPUT;
  const PERIOD_TAB = (active) =>
    `px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors ${
      active ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 bg-slate-50'
    }`;

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={[{ label: 'Home', to: '/' }, { label: 'Membership Renewals' }]} />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Membership Renewals</h1>

        {/* Guidance note */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <strong>Important:</strong> Members should only be renewed via this page or online. If a member is changing
          membership class, update their class on their record <em>before</em> processing renewal here.
          If a member is newly eligible for Gift Aid, tick their Gift Aid box below before renewing.
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : data && (
          <>
            {/* Period tabs */}
            <div className="flex gap-1 border-b border-slate-200">
              <button onClick={() => { setPeriod('current_year'); setSelected(new Set()); }} className={PERIOD_TAB(period === 'current_year')}>
                Current year
              </button>
              <button onClick={() => { setPeriod('previous_years'); setSelected(new Set()); }} className={PERIOD_TAB(period === 'previous_years')}>
                Previous years
              </button>
              {data.showNextYear && (
                <button onClick={() => { setPeriod('next_year'); setSelected(new Set()); }} className={PERIOD_TAB(period === 'next_year')}>
                  Next year
                </button>
              )}
            </div>

            {/* Account + payment method selectors */}
            <div className="bg-white/90 rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Finance account</label>
                <select name="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={SELECT + ' w-56'}>
                  {accounts.length === 0 && <option value="">— no active accounts —</option>}
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment method</label>
                <select name="paymentMethod" value={paymentMethod} onChange={(e) => {
                  const method = e.target.value;
                  setPaymentMethod(method);
                  const mappedAccId = payDefaults.current.mappings[method];
                  if (mappedAccId && accounts.some((a) => a.id === mappedAccId)) {
                    setAccountId(mappedAccId);
                  }
                }} className={SELECT + ' w-44'}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Status / result banners */}
            {actionMsg && (
              <p className={`text-sm font-medium px-4 py-2 rounded border ${
                actionMsg.type === 'success' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-300'
              }`}>{actionMsg.text}</p>
            )}
            {result && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                <strong>{result.renewed.length} member{result.renewed.length !== 1 ? 's' : ''} renewed.</strong>
                {result.errors.length > 0 && (
                  <ul className="mt-1 text-red-700">
                    {result.errors.map((e) => <li key={e.memberId}>• {e.memberId}: {e.error}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Confirmation dialog */}
            {confirming && (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-4 py-4 space-y-3">
                <p className="text-sm font-medium text-slate-800">
                  Renew <strong>{selected.size}</strong> member{selected.size !== 1 ? 's' : ''} via <strong>{accounts.find((a) => a.id === accountId)?.name}</strong> ({paymentMethod})?
                  This cannot be undone easily.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmRenew}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
                  >
                    Continue
                  </button>
                  <button onClick={() => setConfirming(false)} className="border border-slate-300 text-slate-600 hover:bg-slate-50 rounded px-5 py-2 text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Members table */}
            <p className="text-sm text-slate-600">
              {filtered.length} member{filtered.length !== 1 ? 's' : ''} shown.
              {data.yearStart && ` Year start: ${fmtDate(data.yearStart)}.`}
            </p>

            {/* Bulk action form */}
            {filtered.length > 0 && (
              <form onSubmit={handleDoWithSelected} className="flex flex-wrap items-center gap-3">
                <select name="action" value={action} onChange={(e) => setAction(e.target.value)} className={SELECT}>
                  <option value="renew">Renew selected members</option>
                  {can('email', 'send') && <option value="send_email">Send email</option>}
                  {can('letters', 'view') && <option value="send_letter">Send letter</option>}
                  {can('poll_set_up', 'view') && <option value="add_to_poll">Add to poll</option>}
                </select>
                {action === 'add_to_poll' && (
                  <select name="chosenPoll" value={chosenPoll} onChange={(e) => setChosenPoll(e.target.value)} className={SELECT + ' w-48'}>
                    {polls.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
                <button
                  type="submit"
                  disabled={processing || selected.size === 0 || confirming}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
                >
                  Do with selected
                </button>
                {selected.size > 0 && <span className="text-sm text-slate-600">{selected.size} selected</span>}
              </form>
            )}

            <div className="overflow-x-auto" ref={tableRef}>
              <table className="min-w-max w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-left">
                  <tr>
                    <th className="px-3 py-2.5">
                      <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} aria-label="Select all" />
                    </th>
                    <th className="px-4 py-2.5 font-normal">#</th>
                    <th className="px-4 py-2.5 font-normal">Name</th>
                    <th className="px-4 py-2.5 font-normal">Class</th>
                    <th className="px-4 py-2.5 font-normal">Partner</th>
                    <th className="px-4 py-2.5 font-normal">Next renewal</th>
                    <th className="px-4 py-2.5 font-normal text-right">Fee due</th>
                    <th className="px-4 py-2.5 font-normal text-center">Gift Aid</th>
                    <th className="px-4 py-2.5 font-normal text-right">Amount received</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const feeLabel = giftAid[m.id] && m.gift_aid_fee != null
                      ? fmtAmount(m.gift_aid_fee)
                      : fmtAmount(m.fee);
                    return (
                      <tr key={m.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(m.id)}
                            onChange={(e) => toggleOne(m.id, e.target.checked)}
                            aria-label={`Select ${m.forenames} ${m.surname}`}
                          />
                        </td>
                        <td className="px-4 py-2">{m.membership_number}</td>
                        <td className="px-4 py-2">
                          <Link to={`/members/${m.id}`} className="text-blue-600 hover:underline">
                            {m.forenames} {m.surname}
                          </Link>
                          <span className="ml-2 text-xs text-slate-400">{m.status_name}</span>
                        </td>
                        <td className="px-4 py-2">{m.class_name ?? '—'}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs">
                          {m.partner_id ? `${m.partner_forenames} ${m.partner_surname}` : ''}
                        </td>
                        <td className="px-4 py-2">{fmtDate(m.next_renewal)}</td>
                        <td className="px-4 py-2 text-right">{feeLabel}</td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={giftAid[m.id] ?? false}
                            onChange={(e) => setGiftAid((prev) => ({ ...prev, [m.id]: e.target.checked }))}
                            aria-label={`Gift Aid for ${m.surname}`}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            name="received"
                            value={received[m.id] ?? ''}
                            onChange={(e) => setReceived((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            className="border border-slate-300 rounded px-2 py-1 text-sm text-right w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                        No members to renew for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Select/Deselect all links at bottom */}
            {filtered.length > 0 && (
              <div className="flex gap-4 text-sm">
                <button onClick={() => toggleAll(true)} className="text-blue-600 hover:underline">Select all</button>
                <button onClick={() => toggleAll(false)} className="text-blue-600 hover:underline">Deselect all</button>
              </div>
            )}

            {/* Doc 4.5.1 / 4.5.2 / 4.5.3 guidance links */}
            <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600 space-y-1">
              <p><strong>Notes:</strong></p>
              <p>• To change a member's class at renewal: update their class on their member record first, then renew here (doc 4.5.1).</p>
              <p>• To reverse a renewal by mistake: go to Finance Ledger, delete the transaction, then edit the member record and set the next renewal date back one year (doc 4.5.2).</p>
              <p>• To generate a list of members who <em>have</em> renewed: use the Polls feature — add non-renewed members to a poll, then use "Negate poll" in the Members list (doc 4.5.3).</p>
            </div>
          </>
        )}
      </div>
      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}
