// beacon2/frontend/src/pages/members/AddressesExport.jsx
// Addresses Export and Label printing (docs 4.8 and 4.8.1).
// Formats: TAM (Excel), Labels (PDF), Excel, CSV, TSV.
// Partners sharing the same address are combined in the same row.

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import {
  addressExport as addressExportApi,
  memberStatuses as statusApi,
  memberClasses  as classApi,
  polls          as pollsApi,
  groups         as groupsApi,
  requestBlob,
} from '../../lib/api.js';
import { hasOptionalCookieConsent } from '../../hooks/useCookieConsent.js';

// ── Label settings localStorage key ─────────────────────────────────────────

const LABEL_PREFS_KEY = 'beacon2_label_settings';
const LAST_CLASS_KEY  = 'beacon2_last_export_class';
const TAM_PREFS_KEY   = 'beacon2_tam_submission';

function loadLabelPrefs() {
  if (!hasOptionalCookieConsent()) return defaultLabelSettings();
  try {
    const raw = localStorage.getItem(LABEL_PREFS_KEY);
    if (raw) return { ...defaultLabelSettings(), ...JSON.parse(raw) };
  } catch {}
  return defaultLabelSettings();
}

function loadLastClass() {
  if (!hasOptionalCookieConsent()) return '';
  try { return localStorage.getItem(LAST_CLASS_KEY) || ''; } catch { return ''; }
}

function saveLastClass(classId) {
  if (!hasOptionalCookieConsent()) return;
  try {
    if (classId) localStorage.setItem(LAST_CLASS_KEY, classId);
    else localStorage.removeItem(LAST_CLASS_KEY);
  } catch {}
}

function loadTamPrefs() {
  if (!hasOptionalCookieConsent()) return null;
  try {
    const raw = localStorage.getItem(TAM_PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveTamPrefs(statusIds, classId) {
  if (!hasOptionalCookieConsent()) return;
  try {
    localStorage.setItem(TAM_PREFS_KEY, JSON.stringify({ statusIds, classId }));
  } catch {}
}

function defaultLabelSettings() {
  return { cols: 3, rows: 7, labelWidth: 70, labelHeight: 38, topOffset: 10, leftOffset: 7, fontSize: 9 };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Group flat member array by address_id (members with null address_id get own groups) */
function groupByAddress(members) {
  const map = new Map();
  for (const m of members) {
    const key = m.address_id || `no-addr-${m.id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        address_id: m.address_id,
        house_no:   m.house_no,
        street:     m.street,
        add_line1:  m.add_line1,
        add_line2:  m.add_line2,
        town:       m.town,
        county:     m.county,
        postcode:   m.postcode,
        members:    [],
      });
    }
    map.get(key).members.push(m);
  }
  return Array.from(map.values());
}

function memberName(m) {
  const first = m.known_as || m.forenames || '';
  return [m.title, first, m.surname].filter(Boolean).join(' ');
}

function combinedName(members) {
  if (members.length === 1) return memberName(members[0]);
  const [a, b] = members;
  if (a.surname === b.surname) {
    const initA = (a.known_as || a.forenames || '').split(/\s+/)[0] || '';
    const initB = (b.known_as || b.forenames || '').split(/\s+/)[0] || '';
    return `${[a.title, initA].filter(Boolean).join(' ')} & ${[b.title, initB].filter(Boolean).join(' ')} ${a.surname}`.trim();
  }
  return `${memberName(a)} & ${memberName(b)}`;
}

function addressDisplay(g) {
  return [
    [g.house_no, g.street].filter(Boolean).join(' '),
    g.add_line1,
    g.add_line2,
    g.town,
    g.county,
    g.postcode,
  ].filter(Boolean).join(', ');
}

const FORMATS = [
  { value: 'tam',   label: 'Third Age Matters (TAM)' },
  { value: 'labels',label: 'Labels (PDF)' },
  { value: 'excel', label: 'Excel' },
  { value: 'csv',   label: 'CSV' },
  { value: 'tsv',   label: 'TSV' },
];

const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddressesExport() {
  const { can, tenant } = useAuth();

  // Format
  const [format, setFormat] = useState('excel');
  // Track whether TAM prefs have already been restored this session
  const [tamPrefsApplied, setTamPrefsApplied] = useState(false);

  // Filter state
  const [statuses,         setStatuses]         = useState([]);
  const [classes,          setClasses]           = useState([]);
  const [polls,            setPolls]             = useState([]);
  const [allGroups,        setAllGroups]         = useState([]);
  const [selectedStatuses, setSelectedStatuses]  = useState([]);
  const [selectedClass,    setSelectedClass]     = useState(loadLastClass);
  const [selectedPoll,     setSelectedPoll]      = useState('');
  const [negatePoll,       setNegatePoll]        = useState(false);
  const [groupSearch,      setGroupSearch]       = useState('');
  const [selectedGroup,    setSelectedGroup]     = useState('');

  // Member data
  const [addressGroups, setAddressGroups] = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);

  // Selection
  const [selected, setSelected] = useState(new Set()); // keys (address group keys)

  // Label settings
  const [labelSettings, setLabelSettings] = useState(loadLabelPrefs);

  // Download state
  const [downloading, setDownloading] = useState(false);
  const [dlError,     setDlError]     = useState(null);

  // ── Load filter options on mount ───────────────────────────────────────────

  useEffect(() => {
    Promise.all([statusApi.list(), classApi.list(), pollsApi.list(), groupsApi.list({ activeOnly: false })])
      .then(([s, c, p, g]) => {
        setStatuses(s);
        setClasses(c);
        setPolls(p);
        setAllGroups(g);
        // Default: select "Current" status
        const current = s.find((x) => x.name === 'Current');
        if (current) setSelectedStatuses([current.id]);
      })
      .catch(() => {});
  }, []);

  // ── Restore TAM prefs when switching to TAM format ──────────────────────
  // Only apply once per session (so user can freely change filters after).

  useEffect(() => {
    if (format !== 'tam' || tamPrefsApplied || statuses.length === 0) return;
    const prefs = loadTamPrefs();
    if (!prefs) return;
    // Validate that saved status IDs still exist
    const validIds = prefs.statusIds?.filter((id) => statuses.some((s) => s.id === id));
    if (validIds?.length) setSelectedStatuses(validIds);
    if (prefs.classId) setSelectedClass(prefs.classId);
    setTamPrefsApplied(true);
  }, [format, tamPrefsApplied, statuses]);

  // ── Load members when filters change ──────────────────────────────────────

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const params = {};
      if (selectedStatuses.length) params.status = selectedStatuses.join(',');
      if (selectedClass)           params.classId  = selectedClass;
      if (selectedPoll)            params.pollId   = selectedPoll;
      if (negatePoll && selectedPoll) params.negatePoll = '1';
      if (selectedGroup)           params.groupId  = selectedGroup;
      const data = await addressExportApi.list(params);
      setAddressGroups(groupByAddress(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedStatuses, selectedClass, selectedPoll, negatePoll, selectedGroup]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ── Selection helpers ─────────────────────────────────────────────────────

  function toggleRow(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(addressGroups.map((g) => g.key)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  // ── Label settings helpers ────────────────────────────────────────────────

  function setLabelField(field, value) {
    setLabelSettings((prev) => ({ ...prev, [field]: value }));
  }

  function saveLabelsAsDefaults() {
    if (!hasOptionalCookieConsent()) return;
    localStorage.setItem(LABEL_PREFS_KEY, JSON.stringify(labelSettings));
  }

  // ── Download ──────────────────────────────────────────────────────────────

  async function handleDownload() {
    const selectedGroups = addressGroups.filter((g) => selected.has(g.key));
    if (!selectedGroups.length) {
      setDlError('Please select at least one address to export.');
      return;
    }
    // Collect all member IDs from selected address groups
    const memberIds = selectedGroups.flatMap((g) => g.members.map((m) => m.id));

    // Save TAM submission prefs when downloading in TAM format
    if (format === 'tam') {
      saveTamPrefs(selectedStatuses, selectedClass);
    }

    setDownloading(true);
    setDlError(null);
    try {
      if (format === 'labels') {
        const qs = new URLSearchParams({
          ids: memberIds.join(','),
          cols:        String(labelSettings.cols),
          rows:        String(labelSettings.rows),
          labelWidth:  String(labelSettings.labelWidth),
          labelHeight: String(labelSettings.labelHeight),
          topOffset:   String(labelSettings.topOffset),
          leftOffset:  String(labelSettings.leftOffset),
          fontSize:    String(labelSettings.fontSize),
        });
        await requestBlob(`/address-export/labels?${qs}`);
      } else {
        const qs = new URLSearchParams({ format, ids: memberIds.join(',') });
        await requestBlob(`/address-export/download?${qs}`);
      }
    } catch (err) {
      setDlError(err.message || 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  // ── Filtered group dropdown ────────────────────────────────────────────────

  const filteredGroups = allGroups.filter(
    (g) => !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase()),
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const downloadLabel = {
    tam:    'Download TAM Spreadsheet',
    labels: 'Download Labels PDF',
    excel:  'Download Excel',
    csv:    'Download CSV',
    tsv:    'Download TSV',
  }[format] ?? 'Download';

  const canView     = can('addresses_export', 'view');
  const canDownload = can('addresses_export', 'download');
  const canLabels   = can('address_labels',   'download');

  if (!canView) {
    return (
      <div className="min-h-screen pb-10">
        <PageHeader tenant={tenant} />
        <NavBar links={[{ label: 'Home', to: '/' }, { label: 'Addresses Export' }]} />
        <div className="max-w-2xl mx-auto px-4 py-8 text-center text-red-600">
          You do not have permission to access this page.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={[{ label: 'Home', to: '/' }, { label: 'Addresses Export' }]} />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <h1 className="text-2xl font-bold text-slate-800">Addresses Export</h1>

        {/* ── Format selector ── */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-700 mb-3">Format</h2>
          <div className="flex flex-wrap gap-4">
            {FORMATS.map((f) => (
              <label key={f.value} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="format"
                  value={f.value}
                  checked={format === f.value}
                  onChange={() => setFormat(f.value)}
                  className="accent-blue-600"
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-700">Filters</h2>

          {/* Status checkboxes */}
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">Status</p>
            <div className="flex flex-wrap gap-3">
              {statuses.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(s.id)}
                    onChange={() =>
                      setSelectedStatuses((prev) =>
                        prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                      )
                    }
                    className="accent-blue-600"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          {/* Class + Poll + Group row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Class */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select
                name="selectedClass"
                value={selectedClass}
                onChange={(e) => { setSelectedClass(e.target.value); saveLastClass(e.target.value); }}
                className={`${inputCls} w-full`}
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Poll + negate */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Poll</label>
              <select
                name="selectedPoll"
                value={selectedPoll}
                onChange={(e) => setSelectedPoll(e.target.value)}
                className={`${inputCls} w-full`}
              >
                <option value="">Any / all</option>
                {polls.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {selectedPoll && (
                <label className="flex items-center gap-1.5 text-sm mt-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={negatePoll}
                    onChange={(e) => setNegatePoll(e.target.checked)}
                    className="accent-blue-600"
                  />
                  Negate poll (members NOT in poll)
                </label>
              )}
            </div>

            {/* Group (searchable) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Group</label>
              <input
                type="text"
                name="groupSearch"
                placeholder="Search groups…"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className={`${inputCls} w-full mb-1`}
              />
              <select
                name="selectedGroup"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className={`${inputCls} w-full`}
              >
                <option value="">All groups</option>
                {filteredGroups.map((g) => (
                  <option
                    key={g.id}
                    value={g.id}
                    style={g.status === 'Inactive' ? { color: '#dc2626' } : undefined}
                  >
                    {g.name}{g.status === 'Inactive' ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Label settings (shown only when Labels format selected) ── */}
        {format === 'labels' && (
          <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-5 space-y-3">
            <h2 className="text-base font-semibold text-slate-700">Label Settings</h2>
            <p className="text-sm text-slate-500">
              Adjust label layout to match your label sheets. Settings are saved on this computer.
              When printing, ensure no scaling is applied (print at 100% / Actual Size).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { key: 'cols',        label: 'Labels across' },
                { key: 'rows',        label: 'Rows down' },
                { key: 'labelWidth',  label: 'Label width (mm)' },
                { key: 'labelHeight', label: 'Label height (mm)' },
                { key: 'topOffset',   label: 'Top offset (mm)' },
                { key: 'leftOffset',  label: 'Left offset (mm)' },
                { key: 'fontSize',    label: 'Font size (pt)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    name={key}
                    value={labelSettings[key]}
                    onChange={(e) => setLabelField(key, parseFloat(e.target.value) || 0)}
                    className={`${inputCls} w-full`}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveLabelsAsDefaults}
              className="text-sm text-blue-700 hover:underline bg-transparent border-0 cursor-pointer p-0"
            >
              Save as defaults
            </button>
            <p className="text-xs text-slate-400 ml-4 inline">
              (saved in this browser only — clear cookies/cache will reset them)
            </p>
          </div>
        )}

        {/* ── Member / address list ── */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-700">
              Members {!loading && `(${addressGroups.length} address groups, ${selected.size} selected)`}
            </h2>
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                onClick={selectAll}
                className="text-blue-700 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="text-blue-700 hover:underline"
              >
                Deselect all
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm mb-3">{error}</p>
          )}

          {loading ? (
            <p className="text-slate-500 text-sm py-4 text-center">Loading…</p>
          ) : addressGroups.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No members match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-max w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2 text-left font-medium text-slate-600 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === addressGroups.length && addressGroups.length > 0}
                        onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                        className="accent-blue-600"
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Name(s)</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {addressGroups.map((g, i) => (
                    <tr
                      key={g.key}
                      className={`${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'} cursor-pointer hover:bg-blue-50`}
                      onClick={() => toggleRow(g.key)}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(g.key)}
                          onChange={() => toggleRow(g.key)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-blue-600"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {combinedName(g.members)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {addressDisplay(g)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Select all / deselect all below table */}
          {addressGroups.length > 10 && (
            <div className="flex gap-3 text-sm mt-3">
              <button type="button" onClick={selectAll} className="text-blue-700 hover:underline">
                Select all
              </button>
              <button type="button" onClick={deselectAll} className="text-blue-700 hover:underline">
                Deselect all
              </button>
            </div>
          )}
        </div>

        {/* ── Download button ── */}
        <div className="flex flex-col items-start gap-2">
          {dlError && (
            <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium">
              {dlError}
            </p>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || selected.size === 0 || (format === 'labels' ? !canLabels : !canDownload)}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
          >
            {downloading ? 'Downloading…' : downloadLabel}
          </button>
          {selected.size === 0 && !loading && (
            <p className="text-sm text-slate-500">Select one or more addresses above to download.</p>
          )}
        </div>
      </div>
    </div>
  );
}
