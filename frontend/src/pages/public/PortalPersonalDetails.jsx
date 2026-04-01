// beacon2/frontend/src/pages/public/PortalPersonalDetails.jsx
// Members Portal — view and update personal details (doc 10.2.4).

import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { portalApi } from '../../lib/api.js';
import PortalVersion from '../../components/PortalVersion.jsx';

export default function PortalPersonalDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  // Photo
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoBlobUrl, setPhotoBlobUrl] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [photoDragOver, setPhotoDragOver] = useState(false);

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    portalApi.getPersonalDetails(slug)
      .then((data) => {
        setForm(data);
        setHasPhoto(!!data.hasPhoto);
        if (data.hasPhoto) {
          portalApi.getPhotoBlob(slug).then((blob) => {
            if (blob) setPhotoBlobUrl(URL.createObjectURL(blob));
          });
        }
      })
      .catch((err) => {
        if (err.message.includes('expired') || err.message.includes('401')) {
          navigate(`/public/${slug}/portal`, { replace: true });
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
    return () => {
      setPhotoBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, [slug, navigate]);

  const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
  const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

  async function processPhotoFile(file) {
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError('Photo must be jpg, png, or gif.');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoError(`Photo exceeds the 2 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }

    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await portalApi.uploadPhoto(slug, base64, file.type);
      const blob = await portalApi.getPhotoBlob(slug);
      if (photoBlobUrl) URL.revokeObjectURL(photoBlobUrl);
      setPhotoBlobUrl(blob ? URL.createObjectURL(blob) : null);
      setHasPhoto(true);
    } catch (err) {
      setPhotoError(err.message || 'Failed to upload photo.');
    } finally {
      setPhotoUploading(false);
    }
  }

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    processPhotoFile(file);
  }

  function handlePhotoDrop(e) {
    e.preventDefault();
    setPhotoDragOver(false);
    processPhotoFile(e.dataTransfer?.files?.[0]);
  }

  async function handlePhotoRemove() {
    if (!confirm('Remove your photo?')) return;
    setPhotoUploading(true);
    try {
      await portalApi.deletePhoto(slug);
      if (photoBlobUrl) URL.revokeObjectURL(photoBlobUrl);
      setPhotoBlobUrl(null);
      setHasPhoto(false);
    } catch (err) {
      setPhotoError(err.message || 'Failed to remove photo.');
    } finally {
      setPhotoUploading(false);
    }
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setSaved('');
  }

  function handleAddressChange(field, value) {
    setForm((prev) => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
    setFieldErrors((prev) => ({ ...prev, [`address.${field}`]: undefined }));
    setSaved('');
  }

  function validate() {
    const errs = {};
    if (!form.forenames?.trim()) errs.forenames = 'Forenames is required.';
    if (!form.surname?.trim()) errs.surname = 'Surname is required.';
    if (!form.email?.trim()) errs.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address.';
    if (!form.address?.postcode?.trim()) errs['address.postcode'] = 'Postcode is required.';
    return errs;
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaved('');
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const result = await portalApi.updatePersonalDetails(slug, {
        title: form.title,
        forenames: form.forenames,
        surname: form.surname,
        knownAs: form.knownAs,
        initials: form.initials,
        suffix: form.suffix,
        email: form.email,
        mobile: form.mobile,
        emergencyContact: form.emergencyContact,
        hideContact: form.hideContact,
        address: form.address,
      });
      setSaved(result.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (result.emailChanged) {
        // Log out — they need to re-verify
        setTimeout(() => {
          sessionStorage.removeItem('portalToken');
          sessionStorage.removeItem('portalMember');
          navigate(`/public/${slug}/portal`);
        }, 3000);
      }
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwError('');
    setPwSaved('');

    if (!pwForm.currentPassword || !pwForm.newPassword) {
      setPwError('Please fill in all password fields.');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (pwForm.newPassword.length < 10) {
      setPwError('Password must be at least 10 characters.');
      return;
    }
    if (!/[a-z]/.test(pwForm.newPassword) || !/[A-Z]/.test(pwForm.newPassword) || !/[0-9]/.test(pwForm.newPassword)) {
      setPwError('Password must contain uppercase, lowercase, and a number.');
      return;
    }

    setPwSaving(true);
    try {
      const result = await portalApi.changePassword(slug, {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwSaved(result.message);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <PortalVersion />
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <PortalVersion />
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium mb-4">{error || 'Failed to load details.'}</p>
          <Link to={`/public/${slug}/portal/home`} className="text-blue-700 hover:underline">
            Return to Members Portal
          </Link>
        </div>
      </div>
    );
  }

  const inputCls = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
  const errCls = 'text-xs text-red-600 mt-0.5';

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 px-4 py-8">
      <PortalVersion />
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link to={`/public/${slug}/portal/home`} className="text-sm text-blue-700 hover:underline">
            &larr; Members Portal
          </Link>
        </div>

        <h1 className="text-xl font-bold text-center text-slate-800 mb-6">
          Update Personal Details
        </h1>

        {saved && (
          <div className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-700 text-sm font-medium text-center mb-4">
            {saved}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} noValidate className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          {/* About Yourself */}
          <fieldset>
            <legend className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">About Yourself</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Title</label>
                <input name="title" className={inputCls} value={form.title} onChange={(e) => handleChange('title', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Forenames <span className="text-red-500">*</span></label>
                <input name="forenames" className={inputCls} value={form.forenames} onChange={(e) => handleChange('forenames', e.target.value)} />
                {fieldErrors.forenames && <p className={errCls}>{fieldErrors.forenames}</p>}
              </div>
              <div>
                <label className={labelCls}>Surname <span className="text-red-500">*</span></label>
                <input name="surname" className={inputCls} value={form.surname} onChange={(e) => handleChange('surname', e.target.value)} />
                {fieldErrors.surname && <p className={errCls}>{fieldErrors.surname}</p>}
              </div>
              <div>
                <label className={labelCls}>Known as</label>
                <input name="knownAs" className={inputCls} value={form.knownAs} onChange={(e) => handleChange('knownAs', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Suffix</label>
                <input name="suffix" className={inputCls} value={form.suffix} onChange={(e) => handleChange('suffix', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Initials</label>
                <input name="initials" className={inputCls} value={form.initials} onChange={(e) => handleChange('initials', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Mobile</label>
                <input name="mobile" className={inputCls} value={form.mobile} onChange={(e) => handleChange('mobile', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Email <span className="text-red-500">*</span></label>
                <input name="email" type="email" className={inputCls} value={form.email} onChange={(e) => handleChange('email', e.target.value)} />
                {fieldErrors.email && <p className={errCls}>{fieldErrors.email}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Emergency Contact</label>
                <input name="emergencyContact" className={inputCls} value={form.emergencyContact} onChange={(e) => handleChange('emergencyContact', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.hideContact || false}
                    onChange={(e) => handleChange('hideContact', e.target.checked)}
                  />
                  Don&apos;t allow Group Leaders to see my contact details
                </label>
              </div>

              {/* Photo upload */}
              <div className="sm:col-span-2">
                <label className={labelCls}>Your Photo</label>
                <div className="flex items-start gap-4">
                  <div
                    onDrop={handlePhotoDrop}
                    onDragOver={(e) => { e.preventDefault(); setPhotoDragOver(true); }}
                    onDragLeave={() => setPhotoDragOver(false)}
                    className={`w-20 h-20 rounded border-2 flex items-center justify-center transition-colors ${
                      photoDragOver
                        ? 'border-blue-400 bg-blue-50'
                        : photoBlobUrl
                          ? 'border-slate-300'
                          : 'border-dashed border-slate-300'
                    }`}
                  >
                    {photoBlobUrl ? (
                      <img src={photoBlobUrl} alt="Your photo"
                        className="w-full h-full object-cover rounded" />
                    ) : (
                      <span className="text-slate-400 text-xs text-center px-1">
                        {photoDragOver ? 'Drop here' : 'No photo'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input type="file" accept="image/jpeg,image/png,image/gif"
                      onChange={handlePhotoSelect}
                      className="hidden" id="portal-photo-upload" />
                    <label htmlFor="portal-photo-upload"
                      className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-blue-600 hover:bg-blue-50 rounded text-sm cursor-pointer transition-colors">
                      {photoUploading ? 'Uploading...' : (hasPhoto ? 'Change Photo' : 'Choose File')}
                    </label>
                    {hasPhoto && (
                      <button type="button" onClick={handlePhotoRemove}
                        disabled={photoUploading}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded text-sm transition-colors">
                        Remove
                      </button>
                    )}
                    <p className="text-xs text-slate-500">
                      jpg, png, or gif — max 2 MB. Drag and drop or click.
                      <br />Square format (1:1) recommended for membership cards.
                    </p>
                    {photoError && <p className="text-xs text-red-600 font-medium">{photoError}</p>}
                  </div>
                </div>
              </div>
            </div>
          </fieldset>

          {/* Address */}
          <fieldset>
            <legend className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">Where You Live</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>House Number/Name</label>
                <input name="houseNo" className={inputCls} value={form.address.houseNo} onChange={(e) => handleAddressChange('houseNo', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Street</label>
                <input name="street" className={inputCls} value={form.address.street} onChange={(e) => handleAddressChange('street', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Additional line</label>
                <input name="addLine1" className={inputCls} value={form.address.addLine1} onChange={(e) => handleAddressChange('addLine1', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Town</label>
                <input name="town" className={inputCls} value={form.address.town} onChange={(e) => handleAddressChange('town', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>County</label>
                <input name="county" className={inputCls} value={form.address.county} onChange={(e) => handleAddressChange('county', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Postcode <span className="text-red-500">*</span></label>
                <input name="postcode" className={inputCls} value={form.address.postcode} onChange={(e) => handleAddressChange('postcode', e.target.value)} />
                {fieldErrors['address.postcode'] && <p className={errCls}>{fieldErrors['address.postcode']}</p>}
              </div>
              <div>
                <label className={labelCls}>Home Phone</label>
                <input name="telephone" className={inputCls} value={form.address.telephone} onChange={(e) => handleAddressChange('telephone', e.target.value)} />
              </div>
            </div>
          </fieldset>

          <div className="text-center pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 text-sm font-medium"
            >
              {saving ? 'Updating...' : 'Update Personal Details'}
            </button>
          </div>
        </form>

        {/* Password change section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-sm font-semibold text-blue-700 uppercase tracking-wide hover:underline"
          >
            {showPassword ? '\u25BC' : '\u25B6'} Update Password
          </button>

          {showPassword && (
            <form onSubmit={handlePasswordChange} noValidate className="mt-4 space-y-4">
              {pwSaved && (
                <div className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-700 text-sm font-medium text-center">
                  {pwSaved}
                </div>
              )}
              {pwError && (
                <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center">
                  {pwError}
                </div>
              )}

              <div>
                <label className={labelCls}>Current Password</label>
                <input
                  type="password" name="currentPassword" className={inputCls}
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>New Password</label>
                <input
                  type="password" name="newPassword" className={inputCls}
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                />
                <p className="text-xs text-slate-500 mt-1">10-72 characters, must include uppercase, lowercase, and number</p>
              </div>
              <div>
                <label className={labelCls}>Confirm New Password</label>
                <input
                  type="password" name="confirmPassword" className={inputCls}
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                />
              </div>
              <div className="text-center">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 text-sm font-medium"
                >
                  {pwSaving ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
