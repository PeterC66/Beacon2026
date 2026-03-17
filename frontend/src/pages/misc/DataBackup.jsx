// beacon2/frontend/src/pages/misc/DataBackup.jsx
// Data Export & Backup (doc 9.5)
// Provides 8 Excel export options and a restore facility.
// Restore auto-detects Beacon (legacy) vs Beacon2 format from the uploaded file.

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { backup as backupApi } from '../../lib/api.js';

const EXPORT_OPTIONS = [
  {
    type: 'members',
    label: 'Members and addresses',
    desc: 'All member records including address details.',
    sheets: 'Members',
  },
  {
    type: 'finance',
    label: 'Finance ledger with detail',
    desc: 'All transactions and category splits.',
    sheets: 'Ledger, Detail',
  },
  {
    type: 'groups',
    label: 'Groups, with members, venues and faculties',
    desc: 'Group records, membership lists, and faculties.',
    sheets: 'Groups, Group members, Venues, Faculties',
  },
  {
    type: 'calendar',
    label: 'Calendar',
    desc: 'Calendar events (not yet implemented in Beacon2).',
    sheets: 'Calendar',
  },
  {
    type: 'system',
    label: 'System users, roles and privileges',
    desc: 'User accounts, roles, and privilege assignments.',
    sheets: 'System Users, Roles, Privileges',
  },
  {
    type: 'officers',
    label: 'u3a Officers',
    desc: 'Office holders and their contact details.',
    sheets: 'u3a Officers',
  },
  {
    type: 'settings',
    label: 'Site settings and set up',
    desc: 'System settings, finance accounts/categories, classes, statuses, polls.',
    sheets: 'Site Settings 1/2, Finance Accounts/Categories, Membership Classes/Fees, Member Statuses, Polls, Poll assignments, System Messages',
  },
];

export default function DataBackup() {
  const { tenant } = useAuth();

  // Export state: track which type is downloading
  const [downloading, setDownloading] = useState(null);
  const [exportError, setExportError] = useState('');

  // Restore state
  const fileRef       = useRef(null);
  const [file, setFile]           = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null); // { ok, format, message } | null
  const [restoreError, setRestoreError]   = useState('');
  const [confirmOpen, setConfirmOpen]     = useState(false);

  async function handleExport(type) {
    setExportError('');
    setDownloading(type);
    try {
      await backupApi.export(type);
    } catch (err) {
      setExportError(err.message || 'Download failed');
    } finally {
      setDownloading(null);
    }
  }

  function handleFileChange(e) {
    const f = e.target.files[0] || null;
    setFile(f);
    setRestoreResult(null);
    setRestoreError('');
  }

  function handleRestoreClick() {
    if (!file) return;
    setConfirmOpen(true);
  }

  async function handleConfirmRestore() {
    setConfirmOpen(false);
    setRestoring(true);
    setRestoreResult(null);
    setRestoreError('');
    try {
      const result = await backupApi.restore(file);
      setRestoreResult(result);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setRestoreError(err.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  }

  const btnBase = 'inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const btnPrimary = `${btnBase} bg-blue-600 hover:bg-blue-700 text-white`;
  const btnGreen   = `${btnBase} bg-green-600 hover:bg-green-700 text-white`;

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={[{ label: 'Home', to: '/' }, { label: 'Data Export & Backup' }]} />

      <div className="max-w-3xl mx-auto px-4 mt-6 space-y-8">

        {/* ── Export ──────────────────────────────────────────────────────── */}
        <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6">
          <h1 className="text-xl font-bold text-slate-800 mb-1">Data Export &amp; Backup</h1>
          <p className="text-sm text-slate-600 mb-5">
            Download your data as an Excel spreadsheet. Files may contain personal
            information — encrypt them if stored externally (e.g. with Excel&apos;s
            Protect Workbook or 7-zip).
          </p>

          {exportError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium">
              {exportError}
            </div>
          )}

          {/* Individual options */}
          <div className="space-y-3 mb-6">
            {EXPORT_OPTIONS.map(({ type, label, desc, sheets }) => (
              <div
                key={type}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-200 rounded-md px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm">{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Sheets: {sheets}</div>
                </div>
                <button
                  onClick={() => handleExport(type)}
                  disabled={downloading !== null}
                  className={`${btnPrimary} shrink-0`}
                >
                  {downloading === type ? (
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  Download
                </button>
              </div>
            ))}
          </div>

          {/* Backup all data */}
          <div className="border-2 border-blue-200 bg-blue-50 rounded-md px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-blue-800 text-sm">Backup all data</div>
              <div className="text-xs text-blue-700 mt-0.5">
                All of the above combined in a single spreadsheet. Best option for a full backup.
              </div>
            </div>
            <button
              onClick={() => handleExport('all')}
              disabled={downloading !== null}
              className={`${btnGreen} shrink-0`}
            >
              {downloading === 'all' ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              Backup all data
            </button>
          </div>
        </section>

        {/* ── Restore ─────────────────────────────────────────────────────── */}
        <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Restore from Backup</h2>
          <p className="text-sm text-slate-600 mb-1">
            Upload a Beacon2 backup or a legacy Beacon export file. The system will
            detect the format automatically.
          </p>
          <p className="text-sm text-slate-600 mb-4">
            <strong>Note:</strong> System user accounts and roles are not affected by a
            restore — only member, group, finance, settings, and related data is replaced.
          </p>

          <div className="rounded-md bg-amber-50 border border-amber-300 px-4 py-3 text-amber-800 text-sm mb-5">
            <strong>Warning:</strong> Restoring will <strong>permanently delete all current data</strong> for
            this u3a and replace it with the contents of the uploaded file. This cannot be undone.
          </div>

          {restoreError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium">
              {restoreError}
            </div>
          )}

          {restoreResult && (
            <div className="mb-4 rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-800 text-sm font-medium">
              ✓ {restoreResult.message}
              {restoreResult.format === 'beacon' && (
                <span className="ml-2 text-xs font-normal">(migrated from Beacon)</span>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Select backup file (.xlsx)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                className="block text-sm text-slate-600
                  file:mr-3 file:py-2 file:px-4 file:rounded file:border-0
                  file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {file && (
                <p className="text-xs text-slate-500 mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
              )}
            </div>

            <button
              onClick={handleRestoreClick}
              disabled={!file || restoring}
              className={`${btnBase} bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300`}
            >
              {restoring ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Restoring…
                </>
              ) : (
                'Restore from this file'
              )}
            </button>
          </div>
        </section>

        <div className="text-sm text-center">
          <Link to="/" className="text-blue-700 hover:underline">← Back to Home</Link>
        </div>
      </div>

      {/* ── Confirmation modal ────────────────────────────────────────────── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold text-slate-800 mb-3">Confirm restore</h3>
            <p className="text-sm text-slate-600 mb-2">
              You are about to restore from:
            </p>
            <p className="text-sm font-medium text-slate-800 bg-slate-100 rounded px-3 py-2 mb-4 break-all">
              {file?.name}
            </p>
            <p className="text-sm text-red-700 font-medium mb-5">
              All current member, group, and finance data will be permanently deleted and
              replaced. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-5 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                className="bg-red-600 hover:bg-red-700 text-white rounded px-5 py-2 text-sm font-medium"
              >
                Yes, restore now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
