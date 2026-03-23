// beacon2/frontend/src/pages/finance/GiftAidDeclaration.jsx
// Gift Aid declaration: view eligible transactions, download Excel, mark as claimed (doc 7.8).

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { giftAid as giftAidApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

const inputCls   = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors';
const btnDanger  = 'border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm';

const CURRENT_YEAR = new Date().getFullYear();

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return '';
  return `${day}/${m}/${y}`;
}

function fmtAmt(n) {
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GiftAidDeclaration() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();

  const [year, setYear]                   = useState(CURRENT_YEAR);
  const [excludeClaimed, setExcludeClaimed] = useState(true);
  const [rows, setRows]                   = useState([]);
  const [yearStart, setYearStart]         = useState('');
  const [yearEnd, setYearEnd]             = useState('');
  const [enabled, setEnabled]             = useState(true);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [selected, setSelected]           = useState(new Set());
  const [downloading, setDownloading]     = useState(false);
  const [marking, setMarking]             = useState(false);
  const [showMarkConfirm, setShowMarkConfirm] = useState(false);
  const [saved, setSaved]                 = useState(false);
  const savedTimer = useRef(null);

  // Build year options: current year down to 5 years back
  const [availableYears, setAvailableYears] = useState([CURRENT_YEAR]);

  useEffect(() => { loadData(); }, [year, excludeClaimed]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const d = await giftAidApi.list({ year, excludeClaimed });
      setEnabled(d.enabled);
      setRows(d.rows ?? []);
      setYearStart(d.yearStart ?? '');
      setYearEnd(d.yearEnd ?? '');
      setSelected(new Set());

      // Build year range based on the year returned
      const actualYear = d.yearNum ?? CURRENT_YEAR;
      if (!availableYears.includes(actualYear)) {
        setAvailableYears([actualYear, ...Array.from({ length: 5 }, (_, i) => actualYear - i - 1)]);
      } else {
        setAvailableYears(Array.from({ length: 6 }, (_, i) => actualYear - i));
      }
      if (year !== actualYear && !year) {
        setYear(actualYear);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  // ─── Selection helpers ──────────────────────────────────────────────────

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(rows.map((r) => r.id))); }
  function selectNone() { setSelected(new Set()); }

  // ─── Actions ────────────────────────────────────────────────────────────

  async function handleDownload() {
    if (selected.size === 0) return;
    setDownloading(true);
    try {
      await giftAidApi.download([...selected], yearStart, yearEnd);
    } catch (err) { setError(err.message); }
    finally { setDownloading(false); }
  }

  async function handleMark() {
    if (selected.size === 0) return;
    setMarking(true);
    try {
      const result = await giftAidApi.mark([...selected]);
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
      setShowMarkConfirm(false);
      await loadData();
    } catch (err) { setError(err.message); }
    finally { setMarking(false); }
  }

  function handleEmail() {
    if (selected.size === 0) return;
    // Collect unique member IDs from selected transactions
    const memberIds = [...new Set(
      rows.filter((r) => selected.has(r.id)).map((r) => r.member_id),
    )];
    // Store member IDs and GA context for email tokens
    sessionStorage.setItem('emailComposeMemberIds', JSON.stringify(memberIds));
    sessionStorage.setItem('emailGiftAidDates', JSON.stringify({ from: yearStart, to: yearEnd }));
    navigate('/email/compose');
  }

  // ─── Sorted data ────────────────────────────────────────────────────────

  const { sorted, sortKey, sortDir, onSort } = useSortedData(rows, 'surname', 'asc');

  // ─── Render ─────────────────────────────────────────────────────────────

  const links = [{ label: 'Home', to: '/' }];
  const canDownload = can('gift_aid_declaration', 'download_and_mark');
  const canEmail = can('email', 'send');

  const totalGA = rows.reduce((s, r) => s + (r.gift_aid_amount ?? 0), 0);
  const selectedTotal = rows
    .filter((r) => selected.has(r.id))
    .reduce((s, r) => s + (r.gift_aid_amount ?? 0), 0);

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={links} current="Gift Aid declaration" />

      <div className="max-w-6xl mx-auto px-4 mt-4">
        <h1 className="text-xl font-bold mb-4">Gift Aid Declaration</h1>

        {!enabled && (
          <p className="text-sm text-slate-500">
            Gift Aid is not enabled. Enable it in System Settings.
          </p>
        )}

        {enabled && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Financial Year</label>
                <select
                  name="year"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10))}
                  className={inputCls}
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm pb-2">
                <input
                  type="checkbox"
                  checked={excludeClaimed}
                  onChange={(e) => setExcludeClaimed(e.target.checked)}
                />
                Exclude previously claimed
              </label>

              {yearStart && yearEnd && (
                <span className="text-sm text-slate-500 pb-2">
                  {fmtDate(yearStart)} &ndash; {fmtDate(yearEnd)}
                </span>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
                {error}
              </div>
            )}

            {saved && (
              <div className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-700 text-sm font-medium text-center mb-4">
                Transactions marked as claimed.
              </div>
            )}

            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500">No Gift Aid eligible transactions found for this period.</p>
            ) : (
              <>
                {/* Selection controls & actions */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <button onClick={selectAll} className="text-blue-700 hover:underline text-sm">Select All</button>
                  <button onClick={selectNone} className="text-blue-700 hover:underline text-sm">Clear</button>
                  <span className="text-sm text-slate-500">
                    {selected.size} of {rows.length} selected
                    {selected.size > 0 && ` (${fmtAmt(selectedTotal)})`}
                  </span>

                  <div className="flex-1" />

                  {canDownload && (
                    <>
                      <button
                        onClick={handleDownload}
                        disabled={selected.size === 0 || downloading}
                        className={btnPrimary}
                      >
                        {downloading ? 'Downloading...' : 'Download Excel'}
                      </button>
                      <button
                        onClick={() => setShowMarkConfirm(true)}
                        disabled={selected.size === 0 || marking}
                        className={btnDanger}
                      >
                        Mark as Claimed
                      </button>
                    </>
                  )}
                  {canEmail && (
                    <button
                      onClick={handleEmail}
                      disabled={selected.size === 0}
                      className={btnPrimary}
                    >
                      Send Email
                    </button>
                  )}
                </div>

                {/* Mark confirmation dialog */}
                {showMarkConfirm && (
                  <div className="rounded-md bg-amber-50 border border-amber-300 px-4 py-3 text-amber-800 text-sm mb-4">
                    <p className="font-medium mb-2">Mark {selected.size} transaction(s) as claimed?</p>
                    <p className="mb-3">
                      These transactions will not appear again in subsequent declarations.
                      Only select Mark when you are intending to use the download to make a Gift Aid claim.
                    </p>
                    <div className="flex gap-3">
                      <button onClick={handleMark} disabled={marking} className={btnDanger}>
                        {marking ? 'Marking...' : 'Mark'}
                      </button>
                      <button onClick={() => setShowMarkConfirm(false)} className="text-slate-600 hover:underline text-sm">
                        Skip
                      </button>
                    </div>
                  </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-max w-full text-sm border border-slate-300">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-2 py-1 border-b border-slate-300 w-8">
                          <input
                            type="checkbox"
                            checked={selected.size === rows.length && rows.length > 0}
                            onChange={() => selected.size === rows.length ? selectNone() : selectAll()}
                          />
                        </th>
                        <SortableHeader label="Mem No" field="membership_number" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                        <SortableHeader label="Title" field="title" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                        <SortableHeader label="Surname" field="surname" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                        <SortableHeader label="Forenames" field="forenames" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                        <SortableHeader label="Date" field="date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                        <SortableHeader label="GA Amount" field="gift_aid_amount" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                        <th className="px-3 py-1 border-b border-slate-300 text-left">Claimed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r, i) => (
                        <tr
                          key={r.id}
                          className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}
                        >
                          <td className="px-2 py-1 border-b border-slate-200 text-center">
                            <input
                              type="checkbox"
                              checked={selected.has(r.id)}
                              onChange={() => toggleOne(r.id)}
                            />
                          </td>
                          <td className="px-3 py-1 border-b border-slate-200">{r.membership_number}</td>
                          <td className="px-3 py-1 border-b border-slate-200">{r.title ?? ''}</td>
                          <td className="px-3 py-1 border-b border-slate-200">{r.surname}</td>
                          <td className="px-3 py-1 border-b border-slate-200">{r.forenames}</td>
                          <td className="px-3 py-1 border-b border-slate-200">{fmtDate(r.date)}</td>
                          <td className="px-3 py-1 border-b border-slate-200 text-right">{fmtAmt(r.gift_aid_amount)}</td>
                          <td className="px-3 py-1 border-b border-slate-200">
                            {r.gift_aid_claimed_at ? fmtDate(r.gift_aid_claimed_at) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-medium">
                        <td colSpan={6} className="px-3 py-1 border-t border-slate-300 text-right">Total:</td>
                        <td className="px-3 py-1 border-t border-slate-300 text-right">{fmtAmt(totalGA)}</td>
                        <td className="border-t border-slate-300" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
