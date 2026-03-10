// beacon2/frontend/src/pages/members/MemberEditor.jsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { members as membersApi, memberStatuses as statusApi, memberClasses as classApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import DateInput from '../../components/DateInput.jsx';

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

// Standard UK postcode pattern (outward + optional space + inward)
const UK_POSTCODE_RE = /^(GIR\s?0AA|[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][ABD-HJLNP-UW-Z]{2})$/i;

function isValidUKPostcode(value) {
  return UK_POSTCODE_RE.test(value.trim());
}

function validatePhone(value) {
  if (!value || !value.trim()) return null;
  try {
    return isValidPhoneNumber(value, 'GB') ? null : 'Enter a valid UK phone number';
  } catch {
    return 'Enter a valid UK phone number';
  }
}

export default function MemberEditor() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { can, tenant } = useAuth();
  const isNew     = !id || id === 'new';

  const [form,           setForm]           = useState(BLANK_FORM);
  const [statuses,       setStatuses]       = useState([]);
  const [classes,        setClasses]        = useState([]);
  const [allMembers,     setAllMembers]     = useState([]);
  const [loading,        setLoading]        = useState(!isNew);
  const [saving,         setSaving]         = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [error,          setError]          = useState(null);
  // All inline validation errors — keyed by field name
  const [fieldErrors,    setFieldErrors]    = useState({});
  // Whether the current address is shared with the linked partner (from server)
  const [addressShared,  setAddressShared]  = useState(false);
  // Display name of the linked partner (from server)
  const [partnerName,    setPartnerName]    = useState('');
  // True when the partner dropdown was changed during this edit session
  const [partnerChanged, setPartnerChanged] = useState(false);

  const selectedClass = classes.find((c) => c.id === form.classId);
  const isAssociate   = selectedClass?.is_associate ?? false;

  // Address fields are read-only when a partner change is pending
  const addressLocked = !isNew && partnerChanged && !!form.existingPartnerId;

  useEffect(() => {
    Promise.all([statusApi.list(), classApi.list()])
      .then(([s, c]) => { setStatuses(s); setClasses(c); })
      .catch(() => {});

    membersApi.list({ status: '' }).then(setAllMembers).catch(() => {});

    if (!isNew) {
      membersApi.get(id)
        .then((m) => {
          setForm({
            title:             m.title          ?? '',
            forenames:         m.forenames       ?? '',
            surname:           m.surname         ?? '',
            knownAs:           m.known_as        ?? '',
            suffix:            m.suffix          ?? '',
            email:             m.email           ?? '',
            mobile:            m.mobile          ?? '',
            statusId:          m.status_id       ?? '',
            classId:           m.class_id        ?? '',
            joinedOn:          m.joined_on        ? m.joined_on.slice(0, 10)        : '',
            nextRenewal:       m.next_renewal     ? m.next_renewal.slice(0, 10)     : '',
            giftAidFrom:       m.gift_aid_from    ? m.gift_aid_from.slice(0, 10)    : '',
            homeU3a:           m.home_u3a        ?? '',
            notes:             m.notes           ?? '',
            hideContact:       m.hide_contact    ?? false,
            houseNo:           m.house_no        ?? '',
            street:            m.street          ?? '',
            addLine1:          m.add_line1       ?? '',
            addLine2:          m.add_line2       ?? '',
            town:              m.town            ?? '',
            county:            m.county          ?? '',
            postcode:          m.postcode        ?? '',
            telephone:         m.telephone       ?? '',
            existingPartnerId: m.partner_id      ?? '',
          });
          setAddressShared(m.address_shared ?? false);
          if (m.partner_forenames || m.partner_surname) {
            setPartnerName(`${m.partner_forenames ?? ''} ${m.partner_surname ?? ''}`.trim());
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear the error for the field as soon as the user edits it
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
  }

  // Validate a single field on blur and merge into fieldErrors
  function handleBlur(field) {
    const errs = runValidation();
    setFieldErrors((prev) => ({ ...prev, [field]: errs[field] ?? null }));
  }

  // Full validation — returns a flat error map (empty = valid)
  function runValidation() {
    const errs = {};
    if (!form.forenames.trim())  errs.forenames = 'Forenames is required';
    if (!form.surname.trim())    errs.surname   = 'Surname is required';
    if (!form.statusId)          errs.statusId  = 'Status is required';
    if (!form.classId)           errs.classId   = 'Class is required';
    if (!form.joinedOn)          errs.joinedOn  = 'Date joined is required';

    // Postcode is required unless sharing a partner's address
    const skipPostcode = (isNew && !!form.existingPartnerId) || addressLocked;
    if (!skipPostcode) {
      if (!form.postcode.trim()) {
        errs.postcode = 'Postcode is required';
      } else if (!isValidUKPostcode(form.postcode)) {
        errs.postcode = 'Enter a valid UK postcode (e.g. SW1A 1AA)';
      }
    } else if (form.postcode.trim() && !isValidUKPostcode(form.postcode)) {
      errs.postcode = 'Enter a valid UK postcode (e.g. SW1A 1AA)';
    }

    const mobileErr = validatePhone(form.mobile);
    if (mobileErr) errs.mobile = mobileErr;
    const telErr = validatePhone(form.telephone);
    if (telErr) errs.telephone = telErr;

    return errs;
  }

  // Partner dropdown changed — confirm then optionally update address fields
  async function handlePartnerChange(newPartnerId) {
    const prevPartnerId = form.existingPartnerId;
    if (newPartnerId === prevPartnerId) return;

    if (!newPartnerId) {
      // Clearing the partner
      if (!confirm(`Remove the partner link for ${form.forenames} ${form.surname}?`)) return;
      setForm((prev) => ({ ...prev, existingPartnerId: '' }));
      setPartnerChanged(prevPartnerId !== '');
      setAddressShared(false);
      setPartnerName('');
      return;
    }

    // Setting a new partner Y
    const partnerRec = allMembers.find((m) => String(m.id) === String(newPartnerId));
    const partnerDisplay = partnerRec
      ? `${partnerRec.forenames} ${partnerRec.surname}`
      : 'this member';

    if (!confirm(
      `Link ${form.forenames} ${form.surname} with ${partnerDisplay} as partner?\n\n` +
      `${partnerDisplay}'s address will be used (their record will also be updated).`
    )) return;

    // Fetch Y's full address
    let partnerAddr = null;
    try {
      const partnerData = await membersApi.get(newPartnerId);
      if (partnerData.postcode) {
        partnerAddr = {
          houseNo:   partnerData.house_no  ?? '',
          street:    partnerData.street    ?? '',
          addLine1:  partnerData.add_line1 ?? '',
          addLine2:  partnerData.add_line2 ?? '',
          town:      partnerData.town      ?? '',
          county:    partnerData.county    ?? '',
          postcode:  partnerData.postcode  ?? '',
          telephone: partnerData.telephone ?? '',
        };
        setPartnerName(partnerDisplay);
      }
    } catch { /* ignore — address stays as-is */ }

    setForm((prev) => ({
      ...prev,
      existingPartnerId: newPartnerId,
      ...(partnerAddr ?? {}),
    }));
    setPartnerChanged(true);
    setAddressShared(false); // address sharing is confirmed only after save+reload
  }

  async function handleSave(e) {
    e.preventDefault();

    // Run full validation and show ALL errors at once
    const errs = runValidation();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setSaving(false);
      return;
    }
    setFieldErrors({});

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

    try {
      if (isNew) {
        await membersApi.create(payload);
      } else {
        const patchPayload = {
          ...payload,
          partnerId: form.existingPartnerId || null,
        };

        if (partnerChanged) {
          // Partner changed: backend handles address linking; don't send address fields
          delete patchPayload.address;
        } else if (addressShared && patchPayload.address) {
          // Existing shared address: ask which scope to apply
          const thisName = `${form.forenames} ${form.surname}`.trim();
          const choice = confirm(
            `Is this address change for both ${partnerName} and ${thisName}, or just ${thisName}?\n\n` +
            `Click OK for both, Cancel for just ${thisName}.`
          );
          patchPayload.addressScope = choice ? 'both' : 'me-only';
        }

        await membersApi.update(id, patchPayload);
      }
      navigate('/members');
    } catch (err) {
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

  // ── Shared classes ──────────────────────────────────────────────────────
  const inputCls   = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const inputErrCls = 'w-full border border-red-400 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400';
  const labelCls   = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionCls = 'bg-white/90 rounded-lg shadow-sm p-4 sm:p-6';
  const errMsgCls  = 'text-xs text-red-600 mt-1';

  function ic(field) { return fieldErrors[field] ? inputErrCls : inputCls; }

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <h1 className="text-xl font-bold text-center">
          {isNew ? 'Add New Member' : `Member Record — ${form.forenames} ${form.surname}`}
        </h1>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <form onSubmit={handleSave} noValidate className="space-y-4">

          {/* ── i) Membership ──────────────────────────────────────── */}
          <div className={sectionCls}>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Membership</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}><strong>Status</strong></label>
                <select value={form.statusId}
                  onChange={(e) => set('statusId', e.target.value)}
                  onBlur={() => handleBlur('statusId')}
                  className={ic('statusId')}>
                  <option value="">— select —</option>
                  {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {fieldErrors.statusId && <p className={errMsgCls}>{fieldErrors.statusId}</p>}
              </div>
              <div>
                <label className={labelCls}><strong>Class</strong></label>
                <select value={form.classId}
                  onChange={(e) => set('classId', e.target.value)}
                  onBlur={() => handleBlur('classId')}
                  className={ic('classId')}>
                  <option value="">— select —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {fieldErrors.classId && <p className={errMsgCls}>{fieldErrors.classId}</p>}
              </div>
              <div>
                <label className={labelCls}><strong>Joined</strong></label>
                <DateInput value={form.joinedOn}
                  onChange={(v) => set('joinedOn', v)}
                  onBlur={() => handleBlur('joinedOn')}
                  className={ic('joinedOn')} />
                {fieldErrors.joinedOn && <p className={errMsgCls}>{fieldErrors.joinedOn}</p>}
              </div>
              <div>
                <label className={labelCls}>Next renewal</label>
                <DateInput value={form.nextRenewal}
                  onChange={(v) => set('nextRenewal', v)}
                  className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── ii) Member's Details ────────────────────────────────── */}
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
                <input type="text" value={form.forenames}
                  onChange={(e) => set('forenames', e.target.value)}
                  onBlur={() => handleBlur('forenames')}
                  className={ic('forenames')} />
                {fieldErrors.forenames && <p className={errMsgCls}>{fieldErrors.forenames}</p>}
              </div>
              <div>
                <label className={labelCls}><strong>Surname</strong></label>
                <input type="text" value={form.surname}
                  onChange={(e) => set('surname', e.target.value)}
                  onBlur={() => handleBlur('surname')}
                  className={ic('surname')} />
                {fieldErrors.surname && <p className={errMsgCls}>{fieldErrors.surname}</p>}
              </div>
              <div>
                <label className={labelCls}>Known as</label>
                <input type="text" value={form.knownAs}
                  onChange={(e) => set('knownAs', e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Suffix <span className="text-slate-400 font-normal">(e.g. MBE)</span></label>
                <input type="text" value={form.suffix}
                  onChange={(e) => set('suffix', e.target.value)}
                  className={inputCls} maxLength={30} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Mobile</label>
                <input type="text" value={form.mobile}
                  onChange={(e) => set('mobile', e.target.value)}
                  onBlur={() => handleBlur('mobile')}
                  className={ic('mobile')} />
                {fieldErrors.mobile && <p className={errMsgCls}>{fieldErrors.mobile}</p>}
              </div>
              {isAssociate && (
                <div>
                  <label className={labelCls}>Home u3a</label>
                  <input type="text" value={form.homeU3a}
                    onChange={(e) => set('homeU3a', e.target.value)}
                    className={inputCls} maxLength={100} />
                </div>
              )}
              <div>
                <label className={labelCls}>Gift Aid from</label>
                <DateInput value={form.giftAidFrom}
                  onChange={(v) => set('giftAidFrom', v)}
                  max={new Date().toISOString().slice(0, 10)}
                  className={inputCls} />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelCls}>Notes</label>
              <textarea rows={3} value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                className={inputCls} />
            </div>

            <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
              <input type="checkbox" checked={form.hideContact}
                onChange={(e) => set('hideContact', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Hide contact details from group leaders
            </label>
          </div>

          {/* ── iii) Address ─────────────────────────────────────────── */}
          <div className={sectionCls}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Address</h2>
              {!isNew && addressShared && partnerName && !partnerChanged && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700">
                  Shared with {partnerName}
                </span>
              )}
              {addressLocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
                  Will share with {partnerName} on save
                </span>
              )}
            </div>

            {/* Partner selector */}
            <div className="mb-4">
              <label className={labelCls}>
                Partner <span className="text-slate-400 font-normal">(shares this address)</span>
              </label>
              <select
                value={form.existingPartnerId}
                onChange={(e) => handlePartnerChange(e.target.value)}
                className={inputCls}
              >
                <option value="">— none —</option>
                {allMembers
                  .filter((m) => String(m.id) !== String(id))
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

            {/* Address fields — locked when a new partner is pending */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${(form.existingPartnerId && isNew) || addressLocked ? 'opacity-40 pointer-events-none' : ''}`}>
              <div>
                <label className={labelCls}>House / flat no.</label>
                <input type="text" value={form.houseNo}
                  onChange={(e) => set('houseNo', e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Street</label>
                <input type="text" value={form.street}
                  onChange={(e) => set('street', e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Additional line 1 <span className="text-slate-400 font-normal">(district / village)</span></label>
                <input type="text" value={form.addLine1}
                  onChange={(e) => set('addLine1', e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Additional line 2</label>
                <input type="text" value={form.addLine2}
                  onChange={(e) => set('addLine2', e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Town</label>
                <input type="text" value={form.town}
                  onChange={(e) => set('town', e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>County</label>
                <input type="text" value={form.county}
                  onChange={(e) => set('county', e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}><strong>Postcode</strong></label>
                <input type="text" value={form.postcode}
                  onChange={(e) => set('postcode', e.target.value)}
                  onBlur={() => handleBlur('postcode')}
                  className={ic('postcode')} maxLength={10} />
                {fieldErrors.postcode && <p className={errMsgCls}>{fieldErrors.postcode}</p>}
              </div>
              <div>
                <label className={labelCls}>Home telephone <span className="text-slate-400 font-normal">(shared)</span></label>
                <input type="text" value={form.telephone}
                  onChange={(e) => set('telephone', e.target.value)}
                  onBlur={() => handleBlur('telephone')}
                  className={ic('telephone')} />
                {fieldErrors.telephone && <p className={errMsgCls}>{fieldErrors.telephone}</p>}
              </div>
            </div>
          </div>

          {/* ── Buttons ─────────────────────────────────────────────── */}
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
