# Codebase Rationalisation — Remaining Recommendations

Produced 2026-04-14. R1–R12 implemented (except R11 which was already done as part of R6);
remaining recommendations documented below.

---

## Completed (for reference)

| # | Title | What was done |
|---|-------|---------------|
| R1 | Shared constants | `shared/constants.js` at repo root; `frontend/src/lib/constants.js` barrel |
| R2 | Shared validation | `frontend/src/lib/validation.js` (`isValidUKPostcode`, `validatePhone`) |
| R3 | Split api.js | `api/core.js`, `api/system.js`, `api/public.js`, `api/portal.js`; `api.js` now 626 lines |
| R5 | Split finance.js | 7 sub-route files under `backend/src/routes/finance/` with shared `helpers.js` |
| R4 | Extract EntityMembers | `components/EntityMembers.jsx` shared by GroupRecord and TeamRecord; net −936 lines |
| R7 | Dissolve misc/ directory | 7 files relocated to `pages/audit/`, `pages/admin/`, `pages/finance/`, `pages/officers/`, `pages/settings/`, and `lib/` |
| R10 | Shared UI primitives | `components/ui/Button.jsx` (6 variants, 3 sizes) and `components/ui/Input.jsx` (inputCls, inputErrCls, labelCls, etc.) |
| R11 | Rename PF → ProtectedFeatureRoute | Already done as part of R6 (lazy loading) |
| R12 | Add missing backend tests | 6 new test files: settings, venues, customFields, eventTypes, privileges, addressExport (69 tests) |

---

## Priority 2 — High Impact, Medium Effort

### ~~R4. Extract shared EntityMembers component from GroupRecord / TeamRecord~~

**Completed** — see completed table above.

---

### ~~R5. Split finance.js backend route into sub-route files~~ ✓ Completed

Implemented in v0.9.2. See `backend/src/routes/finance/` directory.

---

### R6. Lazy loading in App.jsx ✅ Done

**Problem:** `frontend/src/App.jsx` (263 lines) eagerly imports all 82 page components.
Every page is in the initial bundle. Also, `PF` is used 42 times but the abbreviation
is cryptic.

**Implementation steps:**

1. Replace direct imports with `React.lazy()`:
   ```js
   const MemberList = lazy(() => import('./pages/members/MemberList.jsx'));
   ```
2. Wrap the route element in `<Suspense fallback={<div>Loading...</div>}>`:
   ```js
   element: <Suspense fallback={...}><MemberList /></Suspense>
   ```
3. Or wrap the entire `<RouterProvider>` in a single `<Suspense>` for simplicity
4. Rename `PF` → `ProtectedFeatureRoute` (search-replace, 42 occurrences + definition)
5. Consider merging `AuthRequired` into `ProtectedRoute` with a `skipPasswordCheck`
   param — `AuthRequired` is used exactly once (for `/change-password`) and differs
   only in that it skips the `mustChangePassword` redirect

**Files to modify:**
- `frontend/src/App.jsx`

**Testing:** Run `cd frontend && npm test`. Also start the dev server and navigate
between pages to verify lazy loading works (check network tab for chunk loading).

---

## Priority 3 — Medium Impact, Medium Effort

### ~~R7. Dissolve the misc/ page directory~~ ✓ Completed

Implemented in v0.9.2. Seven files relocated from `pages/misc/` to domain directories:
`pages/audit/`, `pages/admin/`, `pages/finance/`, `pages/officers/`, `pages/settings/`,
and `lib/auditHelpers.js`.

~~**Problem:** `frontend/src/pages/misc/` contains 7 files from 5 unrelated domains.
Each has a natural home elsewhere:~~

| File | Current location | Proposed location | Backend route |
|------|-----------------|-------------------|---------------|
| `AuditLog.jsx` | ~~misc/~~ audit/ | **`pages/audit/`** | `audit.js` |
| `AuditRecord.jsx` | ~~misc/~~ audit/ | **`pages/audit/`** | `audit.js` |
| `auditHelpers.js` | ~~misc/~~ lib/ | **`lib/auditHelpers.js`** | (utility) |
| `DataBackup.jsx` | ~~misc/~~ admin/ | **`pages/admin/`** | `backup.js` |
| `GiftAidLog.jsx` | ~~misc/~~ finance/ | **`pages/finance/`** | `giftAid.js` |
| `OfficerList.jsx` | ~~misc/~~ officers/ | **`pages/officers/`** | `offices.js` |
| `PublicLinks.jsx` | ~~misc/~~ settings/ | **`pages/settings/`** | `publicLinks.js` |

~~**Implementation steps:**~~

~~1. Create `pages/audit/` directory~~
~~2. Move `AuditLog.jsx` and `AuditRecord.jsx` to `pages/audit/`~~
~~3. Move `auditHelpers.js` to `lib/auditHelpers.js`~~
~~4. Move `DataBackup.jsx` to `pages/admin/`~~
~~5. Move `GiftAidLog.jsx` to `pages/finance/`~~
~~6. Create `pages/officers/` and move `OfficerList.jsx` there~~
~~7. Move `PublicLinks.jsx` to `pages/settings/`~~
~~8. Update all import paths~~
~~9. Delete empty `pages/misc/` directory~~

~~**Testing:** Run `cd frontend && npm test`. Navigate to Audit Log, Data Backup,
Gift Aid Log, Officers, and Public Links in the browser.~~

---

### R8. Move calendar and team pages to their own directories ✅

**Problem:** `frontend/src/pages/groups/` contains 10 files spanning groups, teams,
calendar, events, faculties, and venues — despite teams, calendar, and event types
each having separate backend route files.

| File | Current directory | Proposed directory |
|------|------------------|--------------------|
| `Calendar.jsx` | groups/ | **new `pages/calendar/`** |
| `EventRecord.jsx` | groups/ | **new `pages/calendar/`** |
| `OpenMeetings.jsx` | groups/ | **new `pages/calendar/`** |
| `TeamList.jsx` | groups/ | **new `pages/teams/`** |
| `TeamRecord.jsx` | groups/ | **new `pages/teams/`** |

Remaining in `groups/`: `GroupList.jsx`, `GroupRecord.jsx`, `FacultyList.jsx`,
`VenueList.jsx`, `VenueEditor.jsx` (5 files — all group-related).

**Implementation steps:**

1. Create `pages/calendar/` and `pages/teams/` directories
2. Move the 5 files listed above
3. Update import paths in `App.jsx`
4. Update internal imports in the moved files (most use `../../lib/` and
   `../../components/` which stay the same depth)
5. If R4 (EntityMembers) was done first, also update the import path for
   `EntityMembers` in the moved `TeamRecord.jsx`

**Testing:** Run `cd frontend && npm test`. Navigate to Calendar, Teams, and
Event Record pages.

---

### ~~R9. Extract shared Zod schemas on the backend~~ ✅ Done (v0.9.3)

**Problem:** 93 `z.object()` definitions are inline across 26 route files. Some are
near-duplicates between `groups.js` and `teams.js`:

- `patchMemberSchema` — `groups.js:717` vs `teams.js:557` (groups version adds
  `waitingSince: z.null().optional()`)
- `bulkRemoveSchema` — `groups.js:763` vs `teams.js:583` (identical)
- `bulkAddSchema` — `groups.js:790` vs `teams.js:605` (differ only in
  `targetGroupId` vs `targetTeamId`)

**Implementation steps:**

1. Create `backend/src/schemas/` directory
2. Create `schemas/common.js` with shared schemas:
   ```js
   export const bulkMemberIdsSchema = z.object({
     memberIds: z.array(z.string().uuid()).min(1),
   });
   ```
3. Create `schemas/groups.js` and `schemas/teams.js` for entity-specific schemas
4. Import shared schemas in route files, replacing inline definitions
5. For schemas that are *almost* identical (like `bulkAddSchema`), use `.extend()`:
   ```js
   const bulkAddToGroupSchema = bulkMemberIdsSchema.extend({
     targetGroupId: z.string().uuid(),
   });
   ```

**Files to modify:**
- Create `backend/src/schemas/common.js`
- `backend/src/routes/groups.js` — import shared schemas
- `backend/src/routes/teams.js` — import shared schemas

**Testing:** Run `cd backend && npm test`.

---

## Priority 4 — Quality of Life

### ~~R10. Shared UI primitives for repeated Tailwind patterns~~ ✓ Completed

Implemented in v0.9.3. Created `frontend/src/components/ui/`:
- `Button.jsx` — 6 variants (primary, danger, dangerOutline, secondary, success) × 3 sizes (sm, default, lg)
- `Input.jsx` — exports `inputCls`, `inputClsCompact`, `inputErrCls`, `selectCls`, `labelCls`

Available for incremental adoption — not yet imported by existing files.

---

### ~~R11. Rename PF → ProtectedFeatureRoute in App.jsx~~ ✓ Completed

Already done as part of R6 (lazy loading). The component was named
`ProtectedFeatureRoute` from the start in the current codebase.

---

### ~~R12. Add missing backend tests~~ ✓ Partially completed

Implemented in v0.9.3 for the 6 low-risk routes (69 new tests):
- `settings.test.js` (20 tests) — all `/settings` endpoints + feature config
- `venues.test.js` (13 tests) — full CRUD
- `eventTypes.test.js` (14 tests) — full CRUD + default-type business rules
- `customFields.test.js` (7 tests) — GET/PATCH
- `addressExport.test.js` (12 tests) — view, download (CSV/TSV/Excel), labels (PDF)
- `privileges.test.js` (3 tests) — GET /privileges/resources

**Still missing** (high/medium risk, future sessions):

| Route file | Lines | Risk |
|-----------|-------|------|
| `backup.js` | 1,663 | **High** — backup/restore is critical |
| `portal.js` | 1,545 | **High** — member-facing portal |
| `public.js` | 1,153 | **High** — public joining flow |
| `teams.js` | 1,033 | **Medium** — largely mirrors groups.js |
| `email.js` | 499 | **Medium** — SendGrid integration |
| `system.js` | ~200 | **Low** — system admin only |

---

## Other observations (not recommendations, informational)

- **Audit logging inconsistency** — `groups.js` and `teams.js` don't call `logAudit()`
  on create/update/delete, while `members.js` and `finance.js` do. Consider adding
  audit logging to groups/teams operations.
- **settings.js uses Prisma directly** while all other routes use raw SQL via
  `tenantQuery`. Minor inconsistency but not urgent.
- **Home.jsx** (16K), **Login.jsx** (11K), **ChangePassword.jsx** sit at the pages
  root rather than in a subdirectory. Could move to `pages/auth/` but low priority.
- **`eventAttendance` missing from `FEATURE_DEPS`** — `FeatureConfig.jsx` shows it
  depends on `events`, but it's not in the shared `FEATURE_DEPS` map. The backend
  `requireFeature` middleware won't check the parent. May be intentional (if the
  middleware is never called with `eventAttendance`) or a bug worth investigating.
