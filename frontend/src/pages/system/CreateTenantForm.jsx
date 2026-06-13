// beacon2/frontend/src/pages/system/CreateTenantForm.jsx
//
// "Create new tenant" form section of SystemDashboard. Presentation only: form
// state and handlers are owned by the parent.

import PasswordInput from '../../components/PasswordInput.jsx';

export default function CreateTenantForm({
  form,
  setForm,
  handleChange,
  handleCreate,
  saving,
  formErr,
}) {
  return (
    <section className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-700 mb-4">Create new tenant</h2>

      {formErr && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {formErr}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">u3a name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="e.g. Oxfordshire u3a"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
            <input
              name="slug"
              value={form.slug}
              onChange={handleChange}
              required
              placeholder="e.g. oxfordshire"
              pattern="[a-z0-9_]+"
              title="Lowercase letters, numbers and underscores only"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Lowercase, no spaces. Users will type this at login.
            </p>
          </div>
        </div>

        <hr className="border-slate-100" />
        <p className="text-sm font-medium text-slate-600">First admin user</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              name="adminName"
              value={form.adminName}
              onChange={handleChange}
              required
              placeholder="e.g. Jane Smith"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              name="adminEmail"
              type="email"
              value={form.adminEmail}
              onChange={handleChange}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
          <input
            name="adminUsername"
            value={form.adminUsername}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                adminUsername: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''),
              }))
            }
            required
            pattern="[a-z0-9]+"
            title="Lowercase letters and numbers only"
            placeholder="e.g. jsmith"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            Used to log in. Lowercase letters and numbers only.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <PasswordInput
            name="adminPassword"
            value={form.adminPassword}
            onChange={handleChange}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">At least 8 characters.</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Creating…' : 'Create tenant'}
        </button>
      </form>
    </section>
  );
}
