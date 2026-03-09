// beacon2/frontend/src/pages/members/MemberEditor.jsx

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { members as membersApi, memberStatuses as statusApi, memberClasses as classApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const BLANK_FORM = {
  title: '', forenames: '', surname: '', knownAs: '', suffix: '', email: '',
  mobile: '', statusId: '', classId: '', joinedOn: '', nextRenewal: '',
  giftAidFrom: '', homeU3a: '', notes: '', hideContact: false,
  // address
  houseNo: '', street: '', addLine1: '', addLine2: '', town: '', county: '', postcode: '', telephone: '',
  // partner
  existingPartnerId: '',
};

const TITLES = ['', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Sir', 'Lady'];

export default function MemberEditor() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { can, tenant } = useAuth();
  const isNew     = !id || id === 'new';

  const [form,        setForm]        = useState(BLANK_FORM);
  const [statuses,    setStatuses]    = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [allMembers,  setAllMembers]  = useState([]);   // for partner dropdown
  const [loading,     setLoading]     = useState(!isNew);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState(null);
  // Phone validation errors
  const [phoneErrors, setPhoneErrors] = useState({ mobile: null, telephone: null });
  // Whether the current member shares an address with their partner
  const [addressShared, setAddressShared] = useState(false);
  // Partner display name (for dialogs/notes)
  const [partnerName,   setPartnerName]   = useState('');
  // Pending save payload — held while waiting for address-scope dialog
  const pendingSave = useRef(null);

  // Is the selected class an associate class?
  const selectedClass = classes.find((c) => c.id === form.classId);
  const isAssociate   = selectedClass?.is_associate ?? false;

  useEffect(() => {
    // Load statuses, classes, and (for partner picker) all members
    Promise.all([statusApi.list(), classApi.list()])
      .then(([s, c]) => { setStatuses(s); setClasses(c); })
      .catch(() => {});

    if (!isNew) {
      membersApi.get(id)
        .then((m) => {
          setForm({
            title:             m.title        ?? '',
            forenames:         m.forenames    ?? '',
            surname:           m.surname      ?? '',
            knownAs:           m.known_as     ?? '',
            suffix:            m.suffix       ?? '',
            email:             m.email        ?? '',
            mobile:            m.mobile       ?? '',
            statusId:          m.status_id    ?? '',
            classId:           m.class_id     ?? '',
            joinedOn:          m.joined_on    ? m.joined_on.slice(0, 10)    : '',
            nextRenewal:       m.next_renewal ? m.next_renewal.slice(0, 10) : '',
            giftAidFrom:       m.gift_aid_from ? m.gift_aid_from.slice(0, 10) : '',
            homeU3a:           m.home_u3a     ?? '',
            notes:             m.notes        ?? '',
            hideContact:       m.hide_contact ?? false,
            houseNo:           m.house_no     ?? '',
            street:            m.street       ?? '',
            addLine1:          m.add_line1    ?? '',
            addLine2:          m.add_line2    ?? '',
            town:              m.town         ?? '',
            county:            m.county       ?? '',
            postcode:          m.postcode     ?? '',
            telephone:         m.telephone    ?? '',
            existingPartnerId: m.partner_id   ?? '',
          });
          setAddressShared(m.address_shared ?? false);
          if (m.partner_forenames || m.partner_surname) {
            setPartnerName(`${m.partner_forenames ?? ''} ${m.partner_surname ?? ''}`.trim());
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));

      // Load member list for partner selector
      membersApi.list({ status: '' })
        .then(setAllMembers)
        .catch(() => {});
    } else {
      // For new member: load all members for partner selector
      membersApi.list({ status: '' })
        .then(setAllMembers)
        .catch(() => {});
    }
  }, [id]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /** Validate a phone field against GB numbers. Returns null if valid/empty, else error string. */
  function validatePhone(value) {
    if (!value || !value.trim()) return null;
    try {
      return isValidPhoneNumber(value, 'GB') ? null : 'Enter a valid UK phone number';
    } catch {
      return 'Enter a valid UK phone number';
    }
  }

  function handlePhoneBlur(field) {
    setPhoneErrors((prev) => ({ ...prev, [field]: validatePhone(form[field]) }));
  }

  /** Build the save payload and trigger save (or address-scope prompt if needed). */
  async function handleSave(e) {
    e.preventDefault();

    // Phone validation gate
    const mobileErr    = validatePhone(form.mobile);
    const telephoneErr = validatePhone(form.telephone);
    setPhoneErrors({ mobile: mobileErr, telephone: telephoneErr });
    if (mobileErr || telephoneErr) return;

    setSaving(true);
    setError(null);

    const payload = {
      title:       form.title       || undefined,
      forenames:   form.forenames,
      surname:     form.surname,
      knownAs:     form.knownAs     || undefined,
      suffix:      form.suffix      || undefined,
      email:       form.email       || undefined,
      mobile:      form.mobile      || undefined,
      statusId:    form.statusId,
      classId:     form.classId,
      joinedOn:    form.joinedOn    || undefined,
      nextRenewal: form.nextRenewal || undefined,
      giftAidFrom: form.giftAidFrom || undefined,
      homeU3a:     isAssociate ? (form.homeU3a || undefined) : undefined,
      notes:       form.notes       || undefined,
      hideContact: form.hideContact,
      address: {
        houseNo:   form.houseNo   || undefined,
        street:    form.street    || undefined,
        addLine1:  form.addLine1  || undefined,
        addLine2:  form.addLine2  || undefined,
        town:      form.town      || undefined,
        county:    form.county    || undefined,
        postcode:  form.postcode  || undefined,
        telephone: form.telephone || undefined,
      },
    };

    if (isNew && form.existingPartnerId) {
      payload.existingPartnerId = form.existingPartnerId;
      delete payload.address;
    }

    // For PATCH on a shared address, ask the user which scope to apply
    if (!isNew && addressShared && payload.address) {
      const thisName = `${form.forenames} ${form.surname}`.trim();
      const choice = confirm(
        `Is this address change for both ${partnerName} and ${thisName}, or just ${thisName}?\n\n` +
        `Click OK for both, Cancel for just ${thisName}.`
      );
      payload.addressScope = choice ? 'both' : 'me-only';
    }

    try {
      if (isNew) {
        await membersApi.create(payload);
      } else {
        // For PATCH, restructure: address stays nested, partnerId at top
        const patchPayload = {
          ...payload,
          partnerId: form.existingPartnerId || null,
        };
        await membersApi.update(id, patchPayload);
      }
      navigate('/members');
    } catch (err) {
      // 409 = duplicate name — prompt to confirm
      if (err.status === 409 && err.body?.code === 'DUPLICATE_NAME') {
        if (confirm(`A member named "${form.forenames} ${form.surname}" already exists. Create anyway?`)) {
          try {
            await membersApi.create(payload, true);
            navigate('/members');
            return;
          } catch (err2) {
            setError(err2.message);
          }
        }
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete member "${form.forenames} ${form.surname}" (#${id})? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await membersApi.delete(id);
      navigate('/members');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Members', to: '/members' },
  ];

  if (loading) return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />
      <p className="text-center text-slate-500 mt-8">Loading…</p>
    </div>
  );

  // ── Shared field/label classes ──────────────────────────────────────────
  const inputCls = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionCls = 'bg-white/90 rounded-lg shadow-sm p-4 sm:p-6';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <h1 className="text-xl font-bold text-center">
          {isNew ? 'Add New Member' : `Member Record — ${form.forenames} ${form.surname}`}
        </h1>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <form onSubmit={handleSave} className="space-y-4">

          {/* ── i) Membership type ─────────────────────────────────── */}
          <div className={sectionCls}>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Membership</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}><strong>Status</strong></label>
                <select value={form.statusId} onChange={(e) => set('statusId', e.target.value)} required className={inputCls}>
                  <option value="">— select —</option>
                  {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}><strong>Class</strong></label>
                <select value={form.classId} onChange={(e) => set('classId', e.target.value)} required className={inputCls}>
                  <option value="">— select —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}><strong>Joined</strong></label>
                <input type="date" value={form.joinedOn} onChange={(e) => set('joinedOn', e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Next renewal</label>
                <input type="date" value={form.nextRenewal} onChange={(e) => set('nextRenewal', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── ii) Member's details ───────────────────────────────── */}
          <div className={sectionCls}>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Member's Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Title</label>
                <select value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls}>
                  {TITLES.map((t) => <option key={t} value={t}>{t || '—'}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}><strong>Forenames</strong></label>
                <input type="text" value={form.forenames} onChange={(e) => set('forenames', e.target.value)}
                  required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}><strong>Surname</strong></label>
                <input type="text" value={form.surname} onChange={(e) => set('surname', e.target.value)}
                  required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Known as</label>
                <input type="text" value={form.knownAs} onChange={(e) => set('knownAs', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Suffix <span className="text-slate-400 font-normal">(e.g. MBE)</span></label>
                <input type="text" value={form.suffix} onChange={(e) => set('suffix', e.target.value)} className={inputCls} maxLength={30} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Mobile</label>
                <input type="text" value={form.mobile}
                  onChange={(e) => set('mobile', e.target.value)}
                  onBlur={() => handlePhoneBlur('mobile')}
                  className={inputCls + (phoneErrors.mobile ? ' border-red-400' : '')} />
                {phoneErrors.mobile && <p className="text-xs text-red-600 mt-1">{phoneErrors.mobile}</p>}
              </div>
              {isAssociate && (
                <div>
                  <label className={labelCls}>Home u3a</label>
                  <input type="text" value={form.homeU3a} onChange={(e) => set('homeU3a', e.target.value)} className={inputCls} maxLength={100} />
                </div>
              )}
              <div>
                <label className={labelCls}>Gift Aid from</label>
                <input type="date" value={form.giftAidFrom}
                  onChange={(e) => set('giftAidFrom', e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className={inputCls} />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelCls}>Notes</label>
              <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={inputCls} />
            </div>

            <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
              <input type="checkbox" checked={form.hideContact} onChange={(e) => set('hideContact', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Hide contact details from group leaders
            </label>
          </div>

          {/* ── iii) Address ───────────────────────────────────────── */}
          <div className={sectionCls}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Address</h2>
              {!isNew && addressShared && partnerName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700">
                  Shared with {partnerName}
                </span>
              )}
            </div>

            {/* Partner — if set, note that address is shared */}
            <div className="mb-4">
              <label className={labelCls}>
                Partner <span className="text-slate-400 font-normal">(shares this address)</span>
              </label>
              <select
                value={form.existingPartnerId}
                onChange={(e) => set('existingPartnerId', e.target.value)}
                className={inputCls}
              >
                <option value="">— none —</option>
                {allMembers
                  .filter((m) => m.id !== id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.membership_number} — {m.surname}, {m.forenames}
                    </option>
                  ))}
              </select>
              {form.existingPartnerId && isNew && (
                <p className="text-xs text-slate-500 mt-1 italic">
                  Partner's address will be shared. The address fields below are not used.
                </p>
              )}
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${form.existingPartnerId && isNew ? 'opacity-40 pointer-events-none' : ''}`}>
              <div>
                <label className={labelCls}>House / flat no.</label>
                <input type="text" value={form.houseNo} onChange={(e) => set('houseNo', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Street</label>
                <input type="text" value={form.street} onChange={(e) => set('street', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Additional line 1 <span className="text-slate-400 font-normal">(district / village)</span></label>
                <input type="text" value={form.addLine1} onChange={(e) => set('addLine1', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Additional line 2</label>
                <input type="text" value={form.addLine2} onChange={(e) => set('addLine2', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Town</label>
                <input type="text" value={form.town} onChange={(e) => set('town', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>County</label>
                <input type="text" value={form.county} onChange={(e) => set('county', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}><strong>Postcode</strong></label>
                <input type="text" value={form.postcode} onChange={(e) => set('postcode', e.target.value)}
                  required={!(isNew && form.existingPartnerId)} className={inputCls} maxLength={10} />
              </div>
              <div>
                <label className={labelCls}>Home telephone <span className="text-slate-400 font-normal">(shared)</span></label>
                <input type="text" value={form.telephone}
                  onChange={(e) => set('telephone', e.target.value)}
                  onBlur={() => handlePhoneBlur('telephone')}
                  className={inputCls + (phoneErrors.telephone ? ' border-red-400' : '')} />
                {phoneErrors.telephone && <p className="text-xs text-red-600 mt-1">{phoneErrors.telephone}</p>}
              </div>
            </div>
          </div>

          {/* ── Buttons ────────────────────────────────────────────── */}
          <div className="flex gap-3 flex-wrap">
            <button type="submit" disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
              {saving ? 'Saving…' : (isNew ? 'Add Member' : 'Save')}
            </button>

            {!isNew && can('member_record', 'delete') && (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>

        </form>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
