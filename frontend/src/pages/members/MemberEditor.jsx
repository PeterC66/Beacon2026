// beacon2/frontend/src/pages/members/MemberEditor.jsx

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { members as membersApi, memberStatuses as statusApi, memberClasses as classApi, finance as financeApi, polls as pollsApi, settings as settingsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import DateInput from '../../components/DateInput.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

const BLANK_FORM = {
  title: '', forenames: '', surname: '', knownAs: '', suffix: '', email: '',
  mobile: '', statusId: '', classId: '', joinedOn: '', nextRenewal: '',
  giftAidFrom: '', homeU3a: '', notes: '', hideContact: false,
  // address
  houseNo: '', street: '', addLine1: '', addLine2: '', town: '', county: '', postcode: '', telephone: '',
  // partner
  existingPartnerId: '',
  // payment (new member only)
  payAmount: '', payMethod: '', payAccountId: '', payRef: '',
};

const PAYMENT_METHODS = ['Cash', 'Cheque', 'Standing Order', 'Direct Debit', 'BACS', 'Online', 'Other'];

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

/**
 * Compute next renewal date from joined date and year-config settings.
 * Returns an ISO date string (YYYY-MM-DD) or '' if inputs are missing.
 *
 * Formula:
 *   1. Find the next occurrence of (yearStartMonth/yearStartDay) after joinedOn.
 *   2. If extendedMembershipMonth is set and join calendar-month >= that month,
 *      add one extra year (member's first term covers the following year too).
 */
function computeNextRenewal(joinedOnIso, config) {
  if (!joinedOnIso || !config) return '';
  const { yearStartMonth, yearStartDay, extendedMembershipMonth } = config;
  // Parse in local time to avoid UTC-offset surprises on the date boundary
  const [jy, jm, jd] = joinedOnIso.split('-').map(Number);
  const joinDate      = new Date(jy, jm - 1, jd);
  const joinMonth     = jm; // calendar month 1-12

  // First occurrence of year-start on or after the join date
  const thisYrStart = new Date(jy, yearStartMonth - 1, yearStartDay);
  let renewalYear   = joinDate >= thisYrStart ? jy + 1 : jy;

  // Extended membership: if joined in month >= extendedMembershipMonth, skip one more year
  if (extendedMembershipMonth != null && joinMonth >= extendedMembershipMonth) {
    renewalYear += 1;
  }

  const d = new Date(renewalYear, yearStartMonth - 1, yearStartDay);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const [accounts,       setAccounts]       = useState([]);
  const [loading,        setLoading]        = useState(!isNew);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const savedTimer                          = useRef(null);
  const [deleting,       setDeleting]       = useState(false);
  const [error,          setError]          = useState(null);
  const { markDirty, markClean } = useUnsavedChanges();
  // All inline validation errors — keyed by field name
  const [fieldErrors,    setFieldErrors]    = useState({});
  // Whether the current address is shared with the linked partner (from server)
  const [addressShared,  setAddressShared]  = useState(false);
  // Display name of the linked partner (from server)
  const [partnerName,    setPartnerName]    = useState('');
  // True when the partner dropdown was changed during this edit session
  const [partnerChanged, setPartnerChanged] = useState(false);

  // ── Year config for auto-computing next renewal ───────────────────────
  const [yearConfig, setYearConfig] = useState(null);

  // ── A: New partner joining at the same time ──────────────────────────
  const [newPartnerMode, setNewPartnerMode] = useState(false);
  const [npForm, setNpForm] = useState({
    title: '', forenames: '', surname: '', knownAs: '', email: '', mobile: '',
    statusId: '', classId: '', joinedOn: '', nextRenewal: '', giftAidFrom: '',
  });

  // ── B: Renew existing partner prompt ─────────────────────────────────
  const [partnerDueRenewal, setPartnerDueRenewal] = useState(false);  // show prompt
  const [renewPartner,      setRenewPartner]      = useState(false);  // checkbox
  const [partnerNewRenewal, setPartnerNewRenewal] = useState('');     // new date

  // ── C: Partner class mismatch prompt ─────────────────────────────────
  const [partnerClassMismatch, setPartnerClassMismatch] = useState(false);
  const [partnerNewClassId,    setPartnerNewClassId]    = useState('');

  // ── Gift Aid checkbox (new member only) ──────────────────────────────
  const [giftAidTick,   setGiftAidTick]   = useState(false);

  // ── Groups & Ledger section ───────────────────────────────────────────
  const [memberGroups,  setMemberGroups]  = useState([]);
  const [memberTxns,    setMemberTxns]    = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // ── Polls ─────────────────────────────────────────────────────────────
  const [allPolls,      setAllPolls]      = useState([]);   // all polls in this u3a
  const [memberPollIds, setMemberPollIds] = useState([]);   // polls this member is in
  const [pollSaving,    setPollSaving]    = useState(false);

  const selectedClass = classes.find((c) => c.id === form.classId);
  const isAssociate   = selectedClass?.is_associate ?? false;
  const classFee      = selectedClass?.fee ?? null;

  // Address fields are read-only when a partner change is pending
  const addressLocked = !isNew && partnerChanged && !!form.existingPartnerId;

  // Auto-compute nextRenewal for new member form when joinedOn or yearConfig changes
  useEffect(() => {
    if (!isNew || !form.joinedOn || !yearConfig) return;
    const computed = computeNextRenewal(form.joinedOn, yearConfig);
    if (computed) set('nextRenewal', computed);
  }, [form.joinedOn, yearConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-compute nextRenewal for the new-partner sub-form
  useEffect(() => {
    if (!isNew || !newPartnerMode || !yearConfig) return;
    const joinDate = npForm.joinedOn || form.joinedOn;
    const computed = computeNextRenewal(joinDate, yearConfig);
    if (computed) setNpForm((prev) => ({ ...prev, nextRenewal: computed }));
  }, [npForm.joinedOn, form.joinedOn, newPartnerMode, yearConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([statusApi.list(), classApi.list(), pollsApi.list()])
      .then(([s, c, p]) => {
        setStatuses(s);
        setClasses(c);
        setAllPolls(p);
        // Auto-set status to "Current" for new members
        if (isNew && s.length > 0) {
          const current = s.find((st) => st.name.toLowerCase() === 'current');
          if (current) setForm((prev) => ({ ...prev, statusId: prev.statusId || String(current.id) }));
        }
      })
      .catch(() => {});

    membersApi.list({ status: '' }).then(setAllMembers).catch(() => {});

    if (isNew) {
      settingsApi.getYearConfig().then(setYearConfig).catch(() => {});

      // Pre-fill default town, county, and STD code from system settings
      settingsApi.getNewMemberDefaults().then((defaults) => {
        setForm((prev) => ({
          ...prev,
          town:      prev.town      || defaults.defaultTown    || '',
          county:    prev.county    || defaults.defaultCounty  || '',
          telephone: prev.telephone || defaults.defaultStdCode || '',
        }));
      }).catch(() => {});

      financeApi.listAccounts()
        .then((accs) => {
          const active = accs.filter((a) => a.active);
          setAccounts(active);
          // Pre-select the locked "Current" account if present
          const current = active.find((a) => a.locked && a.name === 'Current');
          if (current) set('payAccountId', String(current.id));
        })
        .catch(() => {});
    }

    if (!isNew) {
      // Load groups and transactions for the Groups & Ledger section
      setLedgerLoading(true);
      Promise.all([
        membersApi.getGroups(id),
        financeApi.listTransactions({ memberId: id }),
      ]).then(([grps, txns]) => {
        setMemberGroups(grps);
        setMemberTxns(txns);
      }).catch(() => {}).finally(() => setLedgerLoading(false));

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
          setMemberPollIds(m.poll_ids ?? []);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    markDirty();
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
    if (!form.joinedOn)          errs.joinedOn    = 'Date joined is required';
    if (isNew && !form.nextRenewal) errs.nextRenewal = 'Next renewal date is required';

    // Validate new partner fields if in new-partner mode
    if (isNew && newPartnerMode) {
      if (!npForm.forenames.trim())  errs.npForenames  = 'Partner forenames is required';
      if (!npForm.surname.trim())    errs.npSurname    = 'Partner surname is required';
      if (!npForm.statusId)          errs.npStatusId   = 'Partner status is required';
      if (!npForm.classId)           errs.npClassId    = 'Partner class is required';
      if (!npForm.joinedOn)          errs.npJoinedOn   = 'Partner joined date is required';
      if (!npForm.nextRenewal)       errs.npNextRenewal = 'Partner next renewal date is required';
    }

    // Postcode is required unless sharing a partner's address (existing or new)
    const skipPostcode = (isNew && (!!form.existingPartnerId || newPartnerMode)) || addressLocked;
    if (!skipPostcode) {
      if (!form.postcode.trim()) {
        errs.postcode = 'Postcode is required';
      } else if (!isValidUKPostcode(form.postcode)) {
        errs.postcode = 'Enter a valid UK postcode (e.g. SW1A 1AA)';
      }
    }
    // When address is shared we don't send it, so we don't validate postcode format

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

    // Reset B/C state whenever partner changes
    setPartnerDueRenewal(false);
    setRenewPartner(false);
    setPartnerNewRenewal('');
    setPartnerClassMismatch(false);
    setPartnerNewClassId('');

    if (!newPartnerId) {
      // Clearing the partner
      if (!isNew && !confirm(`Remove the partner link for ${form.forenames} ${form.surname}?`)) return;
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

    if (!isNew && !confirm(
      `Link ${form.forenames} ${form.surname} with ${partnerDisplay} as partner?\n\n` +
      `${partnerDisplay}'s address will be used (their record will also be updated).`
    )) return;

    // Fetch Y's full record
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

      // ── B: Check if partner's renewal is due ────────────────────────
      if (isNew && partnerData.next_renewal) {
        const today = new Date().toISOString().slice(0, 10);
        const renewal = partnerData.next_renewal.slice(0, 10);
        if (renewal <= today) {
          setPartnerDueRenewal(true);
          // Default new renewal to one year from their current renewal date
          const nextYear = new Date(renewal);
          nextYear.setFullYear(nextYear.getFullYear() + 1);
          setPartnerNewRenewal(nextYear.toISOString().slice(0, 10));
        }
      }

      // ── C: Check if partner's class differs from the new member's class ──
      if (isNew && form.classId && partnerData.class_id && partnerData.class_id !== form.classId) {
        setPartnerClassMismatch(true);
        setPartnerNewClassId(form.classId); // suggest matching the new member's class
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

  // Toggle new-partner mode (A)
  function handleNewPartnerToggle() {
    const next = !newPartnerMode;
    setNewPartnerMode(next);
    if (next) {
      // Clear existing partner selection when switching to new-partner mode
      setForm((prev) => ({ ...prev, existingPartnerId: '' }));
      // Pre-fill partner's dates and membership from primary form
      setNpForm((prev) => ({
        ...prev,
        statusId:    form.statusId,
        classId:     form.classId,
        joinedOn:    form.joinedOn,
        nextRenewal: form.nextRenewal,
      }));
    }
  }

  function setNp(field, value) {
    setNpForm((prev) => ({ ...prev, [field]: value }));
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
      giftAidFrom: isNew ? (giftAidTick ? new Date().toISOString().slice(0, 10) : undefined) : (form.giftAidFrom || undefined),
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
        postcode:  form.postcode  ? form.postcode.trim().toUpperCase() : undefined,
        telephone: form.telephone || undefined,
      },
    };

    if (isNew && newPartnerMode && npForm.forenames) {
      // A: New partner joining at the same time — address is shared from primary
      payload.newPartner = {
        title:       npForm.title       || undefined,
        forenames:   npForm.forenames,
        surname:     npForm.surname,
        knownAs:     npForm.knownAs     || undefined,
        email:       npForm.email       || undefined,
        mobile:      npForm.mobile      || undefined,
        statusId:    npForm.statusId    || payload.statusId,
        classId:     npForm.classId     || payload.classId,
        joinedOn:    npForm.joinedOn    || payload.joinedOn,
        nextRenewal: npForm.nextRenewal || undefined,
        giftAidFrom: npForm.giftAidFrom || undefined,
      };
    } else if (isNew && form.existingPartnerId) {
      payload.existingPartnerId = form.existingPartnerId;
      delete payload.address;

      // B: Renew partner at the same time
      if (renewPartner && partnerNewRenewal) {
        payload.partnerRenewal = { nextRenewal: partnerNewRenewal };
      }

      // C: Update partner's class
      if (partnerNewClassId && partnerNewClassId !== form.existingPartnerId) {
        payload.partnerClassId = partnerNewClassId;
      }
    }

    // Attach payment details if amount entered
    if (isNew && form.payAmount && form.payAccountId) {
      const payAmt = parseFloat(form.payAmount);
      if (!isNaN(payAmt) && payAmt > 0) {
        // Warn if underpayment — user can proceed
        if (classFee !== null && payAmt < classFee - 0.001) {
          if (!confirm(
            `The amount received (£${payAmt.toFixed(2)}) is less than the expected fee (£${classFee.toFixed(2)}).\n\n` +
            `Continue and record the partial payment?`
          )) {
            setSaving(false);
            return;
          }
        }
        payload.payment = {
          accountId: form.payAccountId,
          amount:    payAmt,
          method:    form.payMethod || undefined,
          ref:       form.payRef    || undefined,
        };
      }
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
      markClean();
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => navigate('/members'), 1200);
    } catch (err) {
      if (err.status === 409 && err.body?.code === 'DUPLICATE_NAME') {
        if (confirm(`A member named "${form.forenames} ${form.surname}" already exists. Create anyway?`)) {
          try {
            await membersApi.create(payload, true);
            markClean();
            navigate('/members');
            return;
          } catch (err2) {
            setError(err2.message);
          }
        }
      } else if (err.status === 422 && err.body?.issues?.length) {
        // Map Zod field errors into inline field errors
        const newErrs = {};
        for (const issue of err.body.issues) {
          // Flatten address.X paths to just X for the flat form state
          const key = issue.path.replace(/^address\./, '');
          newErrs[key] = issue.message;
        }
        setFieldErrors((prev) => ({ ...prev, ...newErrs }));
        setError('Please correct the errors highlighted below.');
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
  const errMsgCls  = 'text-sm text-red-600 mt-1 font-medium';

  function ic(field) { return fieldErrors[field] ? inputErrCls : inputCls; }

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <h1 className="text-xl font-bold text-center">
          {isNew ? 'Add New Member' : `Member Record — ${form.forenames} ${form.surname}`}
        </h1>

        {saved && (
          <p className="text-green-700 text-sm font-medium bg-green-50 border border-green-200 rounded px-3 py-2 text-center">
            ✓ Member record saved.
          </p>
        )}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} noValidate className="space-y-4">

          {/* ── i) Membership ──────────────────────────────────────── */}
          <div className={sectionCls}>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Membership</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!isNew && (
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
              )}
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
                <label className={labelCls}><strong>Next renewal</strong>{isNew && <span className="text-red-500 ml-1">*</span>}</label>
                <DateInput value={form.nextRenewal}
                  onChange={(v) => set('nextRenewal', v)}
                  className={isNew ? ic('nextRenewal') : inputCls} />
                {fieldErrors.nextRenewal && <p className={errMsgCls}>{fieldErrors.nextRenewal}</p>}
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
              <div className="sm:col-span-2 grid grid-cols-[1fr_2fr_auto] gap-4 items-end">
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
                  {form.email && can('email', 'send') && (
                    <button type="button"
                      onClick={() => {
                        sessionStorage.setItem('emailComposeMemberIds', JSON.stringify([id]));
                        navigate('/email/compose');
                      }}
                      className="border border-blue-300 text-blue-600 hover:bg-blue-50 rounded px-3 py-2 text-sm transition-colors whitespace-nowrap"
                      title="Send email to this member"
                    >
                      Send email
                    </button>
                  )}
                </div>
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
              {!isNew && (
                <div>
                  <label className={labelCls}>Gift Aid from</label>
                  <DateInput value={form.giftAidFrom}
                    onChange={(v) => set('giftAidFrom', v)}
                    max={new Date().toISOString().slice(0, 10)}
                    className={inputCls} />
                </div>
              )}
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

            {isNew && (
              <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
                <input type="checkbox" checked={giftAidTick}
                  onChange={(e) => setGiftAidTick(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Tick if eligible for Gift Aid claim (if applicable)
              </label>
            )}
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

              {/* A: New partner mode toggle (new member only) */}
              {isNew && (
                <div className="flex items-center gap-3 mb-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-600">
                    <input type="checkbox" checked={newPartnerMode}
                      onChange={handleNewPartnerToggle}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    Another new member is joining at the same time (new partner)
                  </label>
                </div>
              )}

              {/* Existing-partner dropdown — hidden in new-partner mode */}
              {!newPartnerMode && (
                <>
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

                  {/* B: Partner renewal due prompt */}
                  {isNew && partnerDueRenewal && form.existingPartnerId && (
                    <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-3">
                      <label className="flex items-start gap-2 text-sm cursor-pointer text-amber-800">
                        <input type="checkbox" checked={renewPartner}
                          onChange={(e) => setRenewPartner(e.target.checked)}
                          className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
                        <span><strong>{partnerName}'s</strong> membership renewal is due. Renew at the same time?</span>
                      </label>
                      {renewPartner && (
                        <div className="mt-2 ml-6">
                          <label className={labelCls}>New renewal date for {partnerName}</label>
                          <DateInput value={partnerNewRenewal} onChange={setPartnerNewRenewal} className={inputCls} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* C: Partner class mismatch prompt */}
                  {isNew && partnerClassMismatch && form.existingPartnerId && (
                    <div className="mt-3 rounded-md bg-blue-50 border border-blue-200 p-3">
                      <p className="text-sm text-blue-800 mb-2">
                        <strong>{partnerName}</strong> is in a different membership class. Update their class?
                      </p>
                      <select value={partnerNewClassId} onChange={(e) => setPartnerNewClassId(e.target.value)} className={inputCls}>
                        <option value="">— keep current class —</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* A: New partner details form */}
            {isNew && newPartnerMode && (
              <div className="mb-4 rounded-md bg-slate-50 border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">New Partner's Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Title</label>
                    <select value={npForm.title} onChange={(e) => setNp('title', e.target.value)} className={inputCls}>
                      {TITLES.map((t) => <option key={t} value={t}>{t || '—'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}><strong>Forenames</strong></label>
                    <input type="text" value={npForm.forenames} onChange={(e) => setNp('forenames', e.target.value)}
                      className={fieldErrors.npForenames ? inputErrCls : inputCls} />
                    {fieldErrors.npForenames && <p className={errMsgCls}>{fieldErrors.npForenames}</p>}
                  </div>
                  <div>
                    <label className={labelCls}><strong>Surname</strong></label>
                    <input type="text" value={npForm.surname} onChange={(e) => setNp('surname', e.target.value)}
                      className={fieldErrors.npSurname ? inputErrCls : inputCls} />
                    {fieldErrors.npSurname && <p className={errMsgCls}>{fieldErrors.npSurname}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Known as</label>
                    <input type="text" value={npForm.knownAs} onChange={(e) => setNp('knownAs', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={npForm.email} onChange={(e) => setNp('email', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Mobile</label>
                    <input type="text" value={npForm.mobile} onChange={(e) => setNp('mobile', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}><strong>Status</strong></label>
                    <select value={npForm.statusId} onChange={(e) => setNp('statusId', e.target.value)} className={inputCls}>
                      <option value="">— select —</option>
                      {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}><strong>Class</strong></label>
                    <select value={npForm.classId} onChange={(e) => setNp('classId', e.target.value)} className={inputCls}>
                      <option value="">— select —</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}><strong>Joined</strong></label>
                    <DateInput value={npForm.joinedOn} onChange={(v) => setNp('joinedOn', v)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}><strong>Next renewal</strong><span className="text-red-500 ml-1">*</span></label>
                    <DateInput value={npForm.nextRenewal} onChange={(v) => setNp('nextRenewal', v)} className={fieldErrors.npNextRenewal ? ic('npNextRenewal') : inputCls} />
                    {fieldErrors.npNextRenewal && <p className={errMsgCls}>{fieldErrors.npNextRenewal}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Gift Aid from</label>
                    <DateInput value={npForm.giftAidFrom} onChange={(v) => setNp('giftAidFrom', v)} className={inputCls} />
                  </div>
                </div>
                <p className="text-xs text-slate-400 italic">Address is shared with the primary member above.</p>
              </div>
            )}

            {/* Address fields — locked when a new or existing partner is pending */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${(form.existingPartnerId && isNew) || addressLocked || (isNew && newPartnerMode) ? 'opacity-40 pointer-events-none' : ''}`}>
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

          {/* ── iv) Payment (new member only) ───────────────────────── */}
          {isNew && accounts.length > 0 && (
            <div className={sectionCls}>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Payment</h2>
              {classFee !== null && (
                <p className="text-sm text-slate-600 mb-3">
                  Expected fee: <strong>£{Number(classFee).toFixed(2)}</strong>
                  {classFee === 0 && <span className="text-slate-400 ml-1">(free membership)</span>}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Amount received</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.payAmount}
                      onChange={(e) => set('payAmount', e.target.value)}
                      className={`${inputCls} pl-7`}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Payment method</label>
                  <select value={form.payMethod} onChange={(e) => set('payMethod', e.target.value)} className={inputCls}>
                    <option value="">— select —</option>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Account</label>
                  <select value={form.payAccountId} onChange={(e) => set('payAccountId', e.target.value)} className={inputCls}>
                    <option value="">— select —</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Payment ref <span className="text-slate-400 font-normal">(e.g. cheque no.)</span></label>
                  <input type="text" value={form.payRef}
                    onChange={(e) => set('payRef', e.target.value)}
                    className={inputCls} maxLength={100} />
                </div>
              </div>
              {classFee !== null && form.payAmount && parseFloat(form.payAmount) > classFee + 0.001 && (
                <p className="text-xs text-blue-600 mt-2">
                  Amount exceeds expected fee — £{(parseFloat(form.payAmount) - classFee).toFixed(2)} will be recorded as a donation.
                </p>
              )}
              {!form.payAmount && (
                <p className="text-xs text-slate-400 mt-2 italic">Leave blank to skip recording a payment now.</p>
              )}
            </div>
          )}

          {/* ── Polls ───────────────────────────────────────────────── */}
          {!isNew && allPolls.length > 0 && can('poll_set_up', 'view') && (
            <div className={sectionCls}>
              <h2 className="text-base font-semibold text-slate-700 mb-3">Polls</h2>
              <div className="flex flex-wrap gap-4">
                {allPolls.map((poll) => (
                  <label key={poll.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={memberPollIds.includes(poll.id)}
                      disabled={pollSaving || !can('poll_set_up', 'change')}
                      onChange={async (e) => {
                        const newIds = e.target.checked
                          ? [...memberPollIds, poll.id]
                          : memberPollIds.filter((x) => x !== poll.id);
                        setMemberPollIds(newIds);
                        setPollSaving(true);
                        try { await pollsApi.setForMember(id, newIds); }
                        catch { setMemberPollIds(memberPollIds); } // revert on error
                        finally { setPollSaving(false); }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {poll.name}
                  </label>
                ))}
              </div>
              {pollSaving && <p className="text-xs text-slate-400 mt-2">Saving…</p>}
            </div>
          )}

          {/* ── Groups & Ledger ─────────────────────────────────────── */}
          {!isNew && (
            <div className={sectionCls}>
              <h2 className="text-base font-semibold text-slate-700 mb-3">Groups and Ledger</h2>
              {ledgerLoading ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : (
                <>
                  {/* Groups */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-slate-600 mb-2">Groups</h3>
                    {memberGroups.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">Not a member of any groups.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-max">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic">
                              <th className="px-3 py-2 font-normal">Group name</th>
                              <th className="px-3 py-2 font-normal">Role</th>
                              <th className="px-3 py-2 font-normal">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {memberGroups.map((g, i) => (
                              <tr key={g.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                                <td className="px-3 py-1.5">
                                  {can('group_records_all', 'view') ? (
                                    <a href={`/groups/${g.id}`} className="text-blue-700 hover:underline">{g.name}</a>
                                  ) : (
                                    <span className={g.status === 'inactive' ? 'text-red-600' : ''}>{g.name}</span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-slate-600">
                                  {g.waiting_since ? 'Waiting list' : g.is_leader ? 'Leader' : 'Member'}
                                </td>
                                <td className="px-3 py-1.5">
                                  {g.status === 'inactive'
                                    ? <span className="text-red-600 font-medium">Inactive</span>
                                    : <span className="text-slate-500">Active</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Transactions */}
                  {can('finance_ledger', 'view') && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-600 mb-2">Transactions</h3>
                      {memberTxns.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">No transactions linked to this member.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm min-w-max">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic">
                                <th className="px-3 py-2 font-normal">#</th>
                                <th className="px-3 py-2 font-normal">Date</th>
                                <th className="px-3 py-2 font-normal">Detail</th>
                                <th className="px-3 py-2 font-normal">Account</th>
                                <th className="px-3 py-2 font-normal text-right">In</th>
                                <th className="px-3 py-2 font-normal text-right">Out</th>
                              </tr>
                            </thead>
                            <tbody>
                              {memberTxns.map((t, i) => (
                                <tr key={t.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                                  <td className="px-3 py-1.5">
                                    {can('finance_transactions', 'view') ? (
                                      <a href={`/finance/transactions/${t.id}`} className="text-blue-700 hover:underline font-mono">{t.transaction_number}</a>
                                    ) : (
                                      <span className="font-mono">{t.transaction_number}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 whitespace-nowrap">{t.date ? new Date(t.date).toLocaleDateString('en-GB') : ''}</td>
                                  <td className="px-3 py-1.5 max-w-[200px] truncate" title={t.detail}>{t.detail}</td>
                                  <td className="px-3 py-1.5 text-slate-600">{t.account_name}</td>
                                  <td className="px-3 py-1.5 text-right text-green-700">{t.type === 'in'  ? `£${Number(t.amount).toFixed(2)}` : ''}</td>
                                  <td className="px-3 py-1.5 text-right text-red-700"> {t.type === 'out' ? `£${Number(t.amount).toFixed(2)}` : ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

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
