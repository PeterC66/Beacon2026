// beacon2/frontend/src/pages/email/EmailCompose.jsx
// Compose and send an email to selected members.
// Member IDs are passed via sessionStorage key 'emailComposeMemberIds'.

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { email as emailApi, members as membersApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { hasOptionalCookieConsent } from '../../hooks/useCookieConsent.js';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const EMAIL_PREFS_KEY = 'beacon2_email_compose_prefs';

function loadEmailPrefs() {
  if (!hasOptionalCookieConsent()) return {};
  try {
    const raw = localStorage.getItem(EMAIL_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveEmailPrefs(updates) {
  if (!hasOptionalCookieConsent()) return;
  try {
    const current = loadEmailPrefs();
    localStorage.setItem(EMAIL_PREFS_KEY, JSON.stringify({ ...current, ...updates }));
  } catch {}
}

const TOKENS = [
  { token: '#FAM',         desc: 'Familiar name' },
  { token: '#FORENAME',    desc: 'Forename(s)' },
  { token: '#SURNAME',     desc: 'Surname' },
  { token: '#TITLE',       desc: 'Title' },
  { token: '#MEMNO',       desc: 'Membership number' },
  { token: '#U3ANAME',     desc: 'u3a name' },
  { token: '#EMAIL',       desc: 'Email address' },
  { token: '#TELEPHONE',   desc: 'Telephone' },
  { token: '#MOBILE',      desc: 'Mobile' },
  { token: '#ADDRESSV',    desc: 'Address (vertical)' },
  { token: '#RENEW',       desc: 'Renewal date' },
  { token: '#MEMCLASS',    desc: 'Membership class' },
  { token: '#AFFILIATION', desc: 'Affiliation' },
  { token: '#EMERGENCY',   desc: 'Emergency contact' },
];

const PARTNER_TOKENS = [
  { token: '#PFAM',       desc: "Partner's familiar name" },
  { token: '#PFORENAME',  desc: "Partner's forename" },
  { token: '#PSURNAME',   desc: "Partner's surname" },
  { token: '#PTITLE',     desc: "Partner's title" },
  { token: '#PEMAIL',     desc: "Partner's email" },
  { token: '#PTELEPHONE', desc: "Partner's telephone" },
  { token: '#PMOBILE',    desc: "Partner's mobile" },
];

export default function EmailCompose() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();

  const [memberIds,   setMemberIds]   = useState([]);
  const [recipients,  setRecipients]  = useState([]); // { id, forenames, surname, email }
  const [fromAddrs,   setFromAddrs]   = useState([]);
  const [stdMessages, setStdMessages] = useState([]);

  const [fromEmail,   setFromEmail]   = useState('');
  const [subject,     setSubject]     = useState('');
  const [body,        setBody]        = useState('');
  const [copyToSelf,  setCopyToSelf]  = useState(() => loadEmailPrefs().copyToSelf || false);
  const [attachments, setAttachments] = useState([]); // File[]

  const [saveName,    setSaveName]    = useState('');
  const [loadMsgId,   setLoadMsgId]   = useState('');
  const [showSaveRow, setShowSaveRow] = useState(false);

  const [sending,   setSending]   = useState(false);
  const [error,     setError]     = useState(null);
  const [sent,      setSent]      = useState(null); // { batchId, sent, failed }
  const [giftAidDates, setGiftAidDates] = useState(null); // { from, to } when sent from GA page

  const bodyRef = useRef(null);
  const subjectRef = useRef(null);

  useEffect(() => {
    // Read member IDs from sessionStorage
    try {
      const stored = sessionStorage.getItem('emailComposeMemberIds');
      if (stored) {
        const ids = JSON.parse(stored);
        setMemberIds(ids);
        sessionStorage.removeItem('emailComposeMemberIds');
      }
    } catch {}

    // Read Gift Aid dates from sessionStorage (set by GA declaration page)
    try {
      const gaDates = sessionStorage.getItem('emailGiftAidDates');
      if (gaDates) {
        setGiftAidDates(JSON.parse(gaDates));
        sessionStorage.removeItem('emailGiftAidDates');
      }
    } catch {}

    // Load from-addresses and standard messages
    Promise.all([
      emailApi.getFromAddresses().catch(() => []),
      emailApi.listStandardMessages().catch(() => []),
    ]).then(([addrs, msgs]) => {
      setFromAddrs(addrs);
      if (addrs.length > 0) {
        const saved = loadEmailPrefs().fromEmail;
        const match = saved && addrs.find((a) => a.email === saved);
        setFromEmail(match ? match.email : addrs[0].email);
      }
      setStdMessages(msgs);
    });
  }, []);

  useEffect(() => {
    if (memberIds.length === 0) return;
    // Fetch member display info (name + email) for recipient list
    membersApi.list({}).then((all) => {
      const idSet = new Set(memberIds);
      setRecipients(all.filter((m) => idSet.has(m.id)));
    }).catch(() => {});
  }, [memberIds]);

  function insertToken(token) {
    // Insert token at cursor position in the focused field
    const el = document.activeElement;
    if (el === subjectRef.current) {
      const s = el.selectionStart;
      const e = el.selectionEnd;
      const next = subject.slice(0, s) + token + subject.slice(e);
      setSubject(next);
      setTimeout(() => { el.setSelectionRange(s + token.length, s + token.length); }, 0);
    } else {
      // Default: insert into body
      const el2 = bodyRef.current;
      if (!el2) return;
      const s = el2.selectionStart;
      const e = el2.selectionEnd;
      const next = body.slice(0, s) + token + body.slice(e);
      setBody(next);
      setTimeout(() => { el2.setSelectionRange(s + token.length, s + token.length); el2.focus(); }, 0);
    }
  }

  function handleLoadMsg(id) {
    if (!id) return;
    const msg = stdMessages.find((m) => m.id === id);
    if (msg) {
      if (msg.subject) setSubject(msg.subject);
      setBody(msg.body);
    }
    setLoadMsgId('');
  }

  async function handleSaveMsg() {
    if (!saveName.trim()) return;
    try {
      const saved = await emailApi.saveStandardMessage({ name: saveName.trim(), subject, body });
      setStdMessages((prev) => {
        const filtered = prev.filter((m) => m.name !== saved.name);
        return [...filtered, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSaveName('');
      setShowSaveRow(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!fromEmail || !subject.trim() || !body.trim()) {
      setError('From address, subject, and message body are required.');
      return;
    }
    if (memberIds.length === 0) {
      setError('No recipients selected.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      const sendData = { memberIds, subject, body, fromEmail, replyTo: fromEmail, copyToSelf };
      if (giftAidDates) sendData.giftAidDates = giftAidDates;
      const result = await emailApi.send(sendData, attachments);
      setSent(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const navLinks = [{ label: 'Home', to: '/' }];

  if (sent) {
    return (
      <div className="min-h-screen pb-10">
        <PageHeader tenant={tenant} />
        <NavBar links={navLinks} />
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <p className="text-green-700 font-medium text-lg">Email sent successfully</p>
            <p className="text-slate-600 mt-2">{sent.sent} email{sent.sent !== 1 ? 's' : ''} despatched{sent.failed > 0 ? `, ${sent.failed} failed` : ''}.</p>
            <div className="mt-4 flex justify-center gap-4">
              <Link to={`/email/delivery/${sent.batchId}`} className="text-blue-700 hover:underline text-sm">View delivery status</Link>
              <span className="text-slate-400">|</span>
              <Link to="/" className="text-blue-700 hover:underline text-sm">Home</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const replyToEmail = fromEmail;
  const emailCount = recipients.filter((r) => r.email).length;

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-5xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">Send Email</h1>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Main compose area */}
          <div className="md:col-span-2 space-y-4">

            {/* From */}
            <div className="bg-white/90 rounded-lg shadow-sm p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
                  <select
                    name="fromEmail"
                    value={fromEmail}
                    onChange={(e) => { setFromEmail(e.target.value); saveEmailPrefs({ fromEmail: e.target.value }); }}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {fromAddrs.length === 0 && <option value="">No email address on your member record</option>}
                    {fromAddrs.map((a) => (
                      <option key={a.email} value={a.email}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">To ({recipients.length} recipients, {emailCount} with email)</label>
                  <div className="border border-slate-200 rounded bg-slate-50 px-3 py-2 text-sm text-slate-600 max-h-20 overflow-y-auto">
                    {recipients.length === 0 ? (
                      <span className="text-slate-400 italic">No recipients selected</span>
                    ) : (
                      recipients.slice(0, 5).map((r) => (
                        <div key={r.id}>{r.forenames} {r.surname}{r.email ? ` <${r.email}>` : ' (no email)'}</div>
                      ))
                    )}
                    {recipients.length > 5 && <div className="text-slate-400">… and {recipients.length - 5} more</div>}
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={copyToSelf} onChange={(e) => { setCopyToSelf(e.target.checked); saveEmailPrefs({ copyToSelf: e.target.checked }); }} className="rounded" />
                  Send a copy to myself (at {replyToEmail || 'your address'}) — note: copy will not contain personalised tokens
                </label>
              </div>
            </div>

            {/* Standard messages bar */}
            <div className="bg-white/90 rounded-lg shadow-sm p-3 flex flex-wrap gap-2 items-center">
              <select
                name="loadMsgId"
                value={loadMsgId}
                onChange={(e) => { setLoadMsgId(e.target.value); handleLoadMsg(e.target.value); }}
                className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Load standard message…</option>
                {stdMessages.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setShowSaveRow((v) => !v)}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-3 py-1.5 text-sm"
              >
                Save as standard message
              </button>
              {showSaveRow && (
                <div className="flex gap-2 w-full mt-1">
                  <input
                    type="text"
                    name="saveName"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Message name"
                    className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={handleSaveMsg} className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm">Save</button>
                  <button onClick={() => { setShowSaveRow(false); setSaveName(''); }} className="border border-slate-300 text-slate-700 rounded px-3 py-1.5 text-sm">Cancel</button>
                </div>
              )}
            </div>

            {/* Subject + Body */}
            <div className="bg-white/90 rounded-lg shadow-sm p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <input
                  ref={subjectRef}
                  type="text"
                  name="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email subject (tokens work here too)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  ref={bodyRef}
                  name="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type your message here. Use tokens from the panel on the right to personalise each email."
                />
              </div>
            </div>

            {/* Attachments */}
            <div className="bg-white/90 rounded-lg shadow-sm p-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Attachments <span className="font-normal text-slate-500">(20 MB total limit; not recommended for 50+ recipients)</span></label>
              <input
                type="file"
                multiple
                onChange={(e) => setAttachments(Array.from(e.target.files))}
                className="text-sm"
              />
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                        className="text-red-500 hover:text-red-700 text-xs font-bold"
                      >✕</button>
                      {f.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Send button */}
            <div className="flex gap-3 justify-end">
              <Link to="/" className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-5 py-2 text-sm">
                Cancel
              </Link>
              <button
                onClick={handleSend}
                disabled={sending || !fromEmail || !subject.trim() || !body.trim() || memberIds.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
              >
                {sending ? 'Sending…' : `Send to ${emailCount} recipient${emailCount !== 1 ? 's' : ''}`}
              </button>
            </div>

          </div>

          {/* Token panel */}
          <div className="space-y-3">
            <div className="bg-white/90 rounded-lg shadow-sm p-4">
              <h2 className="text-sm font-bold text-slate-700 mb-2">Tokens — click to insert</h2>
              <p className="text-xs text-slate-500 mb-3">Click a token to insert it at the cursor position in the subject or message body. Tokens are not case-sensitive.</p>
              <div className="space-y-1">
                {TOKENS.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    onClick={() => insertToken(t.token)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 group"
                  >
                    <span className="text-blue-700 font-mono text-xs font-bold">{t.token}</span>
                    <span className="text-slate-500 text-xs ml-2">{t.desc}</span>
                  </button>
                ))}
              </div>
              <h3 className="text-sm font-bold text-slate-700 mt-4 mb-2">Partner Tokens</h3>
              <div className="space-y-1">
                {PARTNER_TOKENS.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    onClick={() => insertToken(t.token)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-blue-50"
                  >
                    <span className="text-blue-700 font-mono text-xs font-bold">{t.token}</span>
                    <span className="text-slate-500 text-xs ml-2">{t.desc}</span>
                  </button>
                ))}
              </div>
              {giftAidDates && (
                <>
                  <h3 className="text-sm font-bold text-slate-700 mt-4 mb-2">Gift Aid Tokens</h3>
                  <div className="space-y-1">
                    {[
                      { token: '#GIFTAID',     desc: 'Gift Aid declaration date' },
                      { token: '#GIFTAIDLIST', desc: 'Gift Aid eligible amounts' },
                    ].map((t) => (
                      <button
                        key={t.token}
                        type="button"
                        onClick={() => insertToken(t.token)}
                        className="w-full text-left px-2 py-1 rounded hover:bg-blue-50"
                      >
                        <span className="text-blue-700 font-mono text-xs font-bold">{t.token}</span>
                        <span className="text-slate-500 text-xs ml-2">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
