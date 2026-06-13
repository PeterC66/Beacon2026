// beacon2/frontend/src/pages/teams/TeamLedger.jsx
// Ledger (cash) tab of the Team record. Extracted from TeamRecord.jsx — no behaviour change.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teams as teamsApi, requestBlob } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import RequiredMark from '../../components/RequiredMark.jsx';

export default function TeamLedger({ teamId }) {
  const { can } = useAuth();
  const navigate = useNavigate();

  const thisYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${thisYear}-01-01`);
  const [toDate, setToDate] = useState(`${thisYear}-12-31`);

  const [broughtForward, setBroughtForward] = useState(0);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const EMPTY_ENTRY = { entryDate: '', payee: '', detail: '', moneyIn: '', moneyOut: '' };
  const [addForm, setAddForm] = useState(EMPTY_ENTRY);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState(null);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  const canChange = can('group_ledger_all', 'change') || can('group_ledger_as_leader', 'change');
  const canCreate = can('group_ledger_all', 'create') || can('group_ledger_as_leader', 'create');
  const canDelete = can('group_ledger_all', 'delete') || can('group_ledger_as_leader', 'delete');
  const canDownload =
    can('group_ledger_all', 'download') || can('group_ledger_as_leader', 'download');

  useEffect(() => {
    load();
  }, [teamId, fromDate, toDate]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await teamsApi.getLedger(teamId, { from: fromDate, to: toDate });
      setBroughtForward(parseFloat(data.broughtForward) || 0);
      setEntries(data.entries || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function fmtDate(d) {
    if (!d) return '';
    const s = String(d).slice(0, 10);
    const [y, m, day] = s.split('-');
    return `${day}/${m}/${y}`;
  }

  function fmtAmt(v) {
    if (v == null || v === '') return '';
    const n = parseFloat(v);
    return isNaN(n) ? '' : n.toFixed(2);
  }

  function computeRows() {
    let balance = broughtForward;
    return entries.map((e) => {
      const inn = parseFloat(e.money_in) || 0;
      const out = parseFloat(e.money_out) || 0;
      balance += inn - out;
      return { ...e, _balance: balance };
    });
  }

  function startEdit(entry) {
    setEditId(entry.id);
    setEditForm({
      entryDate: entry.entry_date ? String(entry.entry_date).slice(0, 10) : '',
      payee: entry.payee ?? '',
      detail: entry.detail ?? '',
      moneyIn: entry.money_in != null ? String(entry.money_in) : '',
      moneyOut: entry.money_out != null ? String(entry.money_out) : '',
    });
    setEditError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm({});
    setEditError(null);
  }

  async function handleSaveEdit(entryId) {
    setEditSaving(true);
    setEditError(null);
    try {
      await teamsApi.updateLedgerEntry(teamId, entryId, {
        entryDate: editForm.entryDate || undefined,
        payee: editForm.payee || null,
        detail: editForm.detail || null,
        moneyIn: editForm.moneyIn ? parseFloat(editForm.moneyIn) : null,
        moneyOut: editForm.moneyOut ? parseFloat(editForm.moneyOut) : null,
      });
      cancelEdit();
      await load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(entryId) {
    if (!window.confirm('Delete this ledger entry?')) return;
    try {
      await teamsApi.deleteLedgerEntry(teamId, entryId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!addForm.entryDate) return;
    setAddSaving(true);
    setAddError(null);
    try {
      await teamsApi.createLedgerEntry(teamId, {
        entryDate: addForm.entryDate,
        payee: addForm.payee || null,
        detail: addForm.detail || null,
        moneyIn: addForm.moneyIn ? parseFloat(addForm.moneyIn) : null,
        moneyOut: addForm.moneyOut ? parseFloat(addForm.moneyOut) : null,
      });
      setAddForm(EMPTY_ENTRY);
      await load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
  }

  async function handleDownload() {
    try {
      const qs = new URLSearchParams({ from: fromDate, to: toDate });
      await requestBlob(`/teams/${teamId}/ledger/download?${qs}`);
    } catch (err) {
      setError(err.message);
    }
  }

  const inputCls =
    'border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-0.5';

  const rows = computeRows();

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Team Cash</h2>
      <p className="text-xs text-slate-600 mb-3">
        The team's own cash record — not linked to the u3a's central accounts. The Finance Ledger
        shows different, complementary transactions.
      </p>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium mb-3">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label htmlFor="tledger-from-date" className={labelCls}>
            From
          </label>
          <input
            id="tledger-from-date"
            name="fromDate"
            type="date"
            className={inputCls}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="tledger-to-date" className={labelCls}>
            To
          </label>
          <input
            id="tledger-to-date"
            name="toDate"
            type="date"
            className={inputCls}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        {canDownload && (
          <button
            onClick={handleDownload}
            className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-1.5 text-sm"
          >
            Download Excel
          </button>
        )}
        {can('finance_transactions', 'view') && (
          <button
            type="button"
            onClick={() => navigate(`/finance/ledger?view=group&groupId=${teamId}`)}
            className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-1.5 text-sm"
            title="View this team's other transactions - in the central ledger"
          >
            Central Ledger
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-max w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200">
                  Date
                </th>
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200">
                  Payee
                </th>
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200">
                  Detail
                </th>
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200 text-right">
                  In (£)
                </th>
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200 text-right">
                  Out (£)
                </th>
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200 text-right">
                  Balance (£)
                </th>
                {(canChange || canDelete) && (
                  <th className="px-3 py-2 border-b border-slate-200"></th>
                )}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-yellow-50">
                <td
                  className="px-3 py-1.5 border-b border-slate-100 font-medium text-slate-600"
                  colSpan={3}
                >
                  Brought Forward
                </td>
                <td className="px-3 py-1.5 border-b border-slate-100 text-right"></td>
                <td className="px-3 py-1.5 border-b border-slate-100 text-right"></td>
                <td className="px-3 py-1.5 border-b border-slate-100 text-right font-medium">
                  {broughtForward.toFixed(2)}
                </td>
                {(canChange || canDelete) && (
                  <td className="px-3 py-1.5 border-b border-slate-100"></td>
                )}
              </tr>

              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={canChange || canDelete ? 7 : 6}
                    className="px-3 py-4 text-center text-slate-400 text-sm"
                  >
                    No transactions in this period.
                  </td>
                </tr>
              )}

              {rows.map((entry, i) =>
                editId === entry.id ? (
                  <tr key={entry.id} className="bg-blue-50">
                    <td
                      className="px-2 py-1 border-b border-slate-100"
                      colSpan={canChange || canDelete ? 7 : 6}
                    >
                      <div className="flex flex-wrap gap-2 items-end">
                        <div>
                          <label htmlFor="tledger-edit-date" className={labelCls}>
                            Date
                          </label>
                          <input
                            id="tledger-edit-date"
                            name="entryDate"
                            type="date"
                            className={inputCls}
                            value={editForm.entryDate}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, entryDate: e.target.value }))
                            }
                          />
                        </div>
                        <div className="flex-1 min-w-32">
                          <label htmlFor="tledger-edit-payee" className={labelCls}>
                            Payee
                          </label>
                          <input
                            id="tledger-edit-payee"
                            name="payee"
                            className={`${inputCls} w-full`}
                            value={editForm.payee}
                            onChange={(e) => setEditForm((p) => ({ ...p, payee: e.target.value }))}
                          />
                        </div>
                        <div className="flex-1 min-w-40">
                          <label htmlFor="tledger-edit-detail" className={labelCls}>
                            Detail
                          </label>
                          <input
                            id="tledger-edit-detail"
                            name="detail"
                            className={`${inputCls} w-full`}
                            value={editForm.detail}
                            onChange={(e) => setEditForm((p) => ({ ...p, detail: e.target.value }))}
                          />
                        </div>
                        <div className="w-24">
                          <label htmlFor="tledger-edit-in" className={labelCls}>
                            In (£)
                          </label>
                          <input
                            id="tledger-edit-in"
                            name="moneyIn"
                            type="number"
                            min="0"
                            step="0.01"
                            className={inputCls}
                            value={editForm.moneyIn}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, moneyIn: e.target.value, moneyOut: '' }))
                            }
                          />
                        </div>
                        <div className="w-24">
                          <label htmlFor="tledger-edit-out" className={labelCls}>
                            Out (£)
                          </label>
                          <input
                            id="tledger-edit-out"
                            name="moneyOut"
                            type="number"
                            min="0"
                            step="0.01"
                            className={inputCls}
                            value={editForm.moneyOut}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, moneyOut: e.target.value, moneyIn: '' }))
                            }
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(entry.id)}
                            disabled={editSaving}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-3 py-1.5 text-sm"
                          >
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="border border-slate-300 text-slate-600 hover:bg-slate-50 rounded px-3 py-1.5 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                        {editError && <span className="text-red-600 text-sm">{editError}</span>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={entry.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                    <td className="px-3 py-1.5 border-b border-slate-100 whitespace-nowrap">
                      {fmtDate(entry.entry_date)}
                    </td>
                    <td className="px-3 py-1.5 border-b border-slate-100">{entry.payee ?? ''}</td>
                    <td className="px-3 py-1.5 border-b border-slate-100">{entry.detail ?? ''}</td>
                    <td className="px-3 py-1.5 border-b border-slate-100 text-right">
                      {fmtAmt(entry.money_in)}
                    </td>
                    <td className="px-3 py-1.5 border-b border-slate-100 text-right">
                      {fmtAmt(entry.money_out)}
                    </td>
                    <td className="px-3 py-1.5 border-b border-slate-100 text-right font-medium">
                      {entry._balance.toFixed(2)}
                    </td>
                    {(canChange || canDelete) && (
                      <td className="px-3 py-1.5 border-b border-slate-100 whitespace-nowrap">
                        {canChange && (
                          <button
                            onClick={() => startEdit(entry)}
                            className="text-blue-600 hover:underline text-sm mr-3"
                          >
                            edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-red-600 hover:underline text-sm"
                          >
                            delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {canCreate && (
        <form onSubmit={handleAdd} className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Detail</h3>
          {addError && <p className="text-red-600 text-sm mb-2">{addError}</p>}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label htmlFor="tledger-add-date" className={labelCls}>
                Date <RequiredMark />
              </label>
              <input
                id="tledger-add-date"
                name="entryDate"
                type="date"
                required
                className={inputCls}
                value={addForm.entryDate}
                onChange={(e) => setAddForm((p) => ({ ...p, entryDate: e.target.value }))}
              />
            </div>
            <div className="flex-1 min-w-32">
              <label htmlFor="tledger-add-payee" className={labelCls}>
                Payee
              </label>
              <input
                id="tledger-add-payee"
                name="payee"
                className={`${inputCls} w-full`}
                value={addForm.payee}
                onChange={(e) => setAddForm((p) => ({ ...p, payee: e.target.value }))}
              />
            </div>
            <div className="flex-1 min-w-40">
              <label htmlFor="tledger-add-detail" className={labelCls}>
                Detail
              </label>
              <input
                id="tledger-add-detail"
                name="detail"
                className={`${inputCls} w-full`}
                value={addForm.detail}
                onChange={(e) => setAddForm((p) => ({ ...p, detail: e.target.value }))}
              />
            </div>
            <div className="w-24">
              <label htmlFor="tledger-add-in" className={labelCls}>
                In (£)
              </label>
              <input
                id="tledger-add-in"
                name="moneyIn"
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={addForm.moneyIn}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, moneyIn: e.target.value, moneyOut: '' }))
                }
              />
            </div>
            <div className="w-24">
              <label htmlFor="tledger-add-out" className={labelCls}>
                Out (£)
              </label>
              <input
                id="tledger-add-out"
                name="moneyOut"
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={addForm.moneyOut}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, moneyOut: e.target.value, moneyIn: '' }))
                }
              />
            </div>
            <button
              type="submit"
              disabled={addSaving || !addForm.entryDate}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
            >
              {addSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
