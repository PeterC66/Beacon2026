// beacon2/frontend/src/pages/misc/DataBackup.jsx
// Data Export & Backup (doc 9.5)
// Provides 8 Excel export options. Restore is only available to system admins.

import { useState } from 'react';
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
    label: 'Groups and teams, with members, venues and faculties',
    desc: 'Group and team records, membership lists, group ledgers, and faculties.',
    sheets: 'Groups, Group members, Group Ledgers, Venues, Faculties',
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

  const [downloading, setDownloading] = useState(null);
  const [exportError, setExportError] = useState('');

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

        <div className="text-sm text-center">
          <Link to="/" className="text-blue-700 hover:underline">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
