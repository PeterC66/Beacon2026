# Codebase Rationalisation — Remaining Recommendations

Produced 2026-04-14. Priority 1 items (R1–R3) were implemented; the rest are
documented below with enough detail to implement in standalone sessions.

---

## Completed (for reference)

| # | Title | What was done |
|---|-------|---------------|
| R1 | Shared constants | `shared/constants.js` at repo root; `frontend/src/lib/constants.js` barrel |
| R2 | Shared validation | `frontend/src/lib/validation.js` (`isValidUKPostcode`, `validatePhone`) |
| R3 | Split api.js | `api/core.js`, `api/system.js`, `api/public.js`, `api/portal.js`; `api.js` now 626 lines |

---

## Priority 2 — High Impact, Medium Effort

### R4. Extract shared EntityMembers component from GroupRecord / TeamRecord

**Problem:** `GroupRecord.jsx` (1,291 lines) and `TeamRecord.jsx` (1,045 lines) are
~70% structurally identical. Their inner Members sub-components share the same logic
for add-by-name, add-by-number, member table with sortable headers, bulk selection,
bulk actions (remove, copy-to-another, send-email), download with field picker, and
leader toggle. The only differences are:

1. API namespace (`groupsApi` vs `teamsApi`)
2. Whether waiting-list filtering applies (groups only)
3. The `targetGroupId` vs `targetTeamId` field name in bulk-add
4. Download field definitions (GroupRecord has 14 fields including `waiting_since`;
   TeamRecord has 13)

The codebase already proves this pattern works — `Schedule.jsx` was extracted as a
shared component used by both GroupRecord and TeamRecord.

**Implementation steps:**

1. Create `frontend/src/components/EntityMembers.jsx`
2. Extract the Members sub-component from GroupRecord (roughly lines 400–850)
3. Parameterise via props:
   - `entityType` — `'group'` or `'team'`
   - `entityId` — the group/team UUID
   - `api` — the API namespace object (`groupsApi` or `teamsApi`)
   - `downloadFields` — array of `{ key, label, default }` objects
   - `showWaitingList` — boolean (true for groups, false for teams)
   - `privilegeResource` — `'group_record'` or `'team_record'`
   - `bulkAddTargetKey` — `'targetGroupId'` or `'targetTeamId'`
4. Update GroupRecord to render `<EntityMembers entityType="group" ... />`
5. Update TeamRecord to render `<EntityMembers entityType="team" ... />`
6. **Also consider** extracting a shared `TabLayout` component (both files implement
   the same tab-strip pattern with `useState` for active tab and conditional rendering)
7. **Also consider** extracting a `useFormSave` hook for the shared
   `[saving, setSaving] + [error, setError] + [saved, setSaved]` triplet with
   3-second auto-dismiss timer

**Files to modify:**
- `frontend/src/pages/groups/GroupRecord.jsx` — extract Members, slim down ~400 lines
- `frontend/src/pages/groups/TeamRecord.jsx` — extract Members, slim down ~400 lines
- Create `frontend/src/components/EntityMembers.jsx` (~350 lines)

**Testing:** Run `cd frontend && npm test` — the GroupRecord and TeamRecord tests
will verify the extraction. Manually test add/remove/toggle/bulk/download on both
a group record and a team record.

---

### R5. Split finance.js backend route into sub-route files

**Problem:** `backend/src/routes/finance.js` is 1,779 lines handling 12 distinct
resource sections:

| Section | Lines | Description |
|---------|-------|-------------|
| Accounts | 18–155 | CRUD + config for finance accounts |
| Group B/F Setting | 156–181 | Single toggle |
| Payment Method Defaults | 182–246 | Default method + per-type mappings |
| Categories | 247–331 | CRUD for finance categories |
| Transactions | 332–641 | CRUD + complex creation with splits |
| Bulk Pending | 642–791 | Bulk pending status toggle |
| Refunds | 792–921 | Refund creation |
| Transfers | 922–1083 | CRUD for money transfers |
| Reconciliation | 1084–1194 | Account reconciliation |
| Financial Statement | 1195–1363 | Statement generation + Excel export |
| Groups Statement | 1364–1491 | Groups statement + Excel export |
| Credit Batches | 1492–1779 | Batch CRUD + transaction management |

**Implementation steps:**

1. Create directory `backend/src/routes/finance/`
2. Create `finance/index.js` — parent Router that mounts sub-routers:
   ```js
   import { Router } from 'express';
   import { requireAuth } from '../../middleware/auth.js';
   import accountsRouter from './accounts.js';
   import categoriesRouter from './categories.js';
   // ... etc
   const router = Router();
   router.use(requireAuth);
   router.use('/', accountsRouter);
   // ...
   export default router;
   ```
3. Create these sub-route files (each gets its own Router):
   - `accounts.js` — Accounts + Group B/F + Payment Method Defaults (~230 lines)
   - `categories.js` — Categories (~85 lines)
   - `transactions.js` — Transactions + Bulk Pending + Refunds (~460 lines)
   - `transfers.js` — Transfer Money (~162 lines)
   - `reconciliation.js` — Reconcile Account (~111 lines)
   - `statements.js` — Financial Statement + Groups Statement (~297 lines)
   - `batches.js` — Credit Batches (~288 lines)
4. Each file imports: `{ Router } from 'express'`, `{ z } from 'zod'`,
   `{ requirePrivilege }`, `{ tenantQuery }`, `{ AppError }`, `{ logAudit }`,
   `{ FINANCE_PAYMENT_METHODS } from '../../../shared/constants.js'` (where needed)
5. Update `backend/src/app.js` to mount the new router — it currently does
   `app.use('/finance', financeRouter)` which should still work if `finance/index.js`
   exports a router the same way
6. Delete the old `finance.js` once all sub-routes are verified

**Testing:** Run `cd backend && npm test` — the existing `finance.test.js` tests
all the routes via HTTP, so it should pass without changes. Also verify the finance
ledger, transaction editor, and statements in the browser.

---

### R6. Lazy loading in App.jsx

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

### R7. Dissolve the misc/ page directory

**Problem:** `frontend/src/pages/misc/` contains 7 files from 5 unrelated domains.
Each has a natural home elsewhere:

| File | Current location | Proposed location | Backend route |
|------|-----------------|-------------------|---------------|
| `AuditLog.jsx` | misc/ | **new `pages/audit/`** | `audit.js` |
| `AuditRecord.jsx` | misc/ | **new `pages/audit/`** | `audit.js` |
| `auditHelpers.js` | misc/ | **`lib/auditHelpers.js`** | (utility) |
| `DataBackup.jsx` | misc/ | **`pages/admin/`** | `backup.js` |
| `GiftAidLog.jsx` | misc/ | **`pages/finance/`** | `giftAid.js` |
| `OfficerList.jsx` | misc/ | **new `pages/officers/`** | `offices.js` |
| `PublicLinks.jsx` | misc/ | **`pages/settings/`** | `publicLinks.js` |

**Implementation steps:**

1. Create `pages/audit/` directory
2. Move `AuditLog.jsx` and `AuditRecord.jsx` to `pages/audit/`
3. Move `auditHelpers.js` to `lib/auditHelpers.js`
4. Move `DataBackup.jsx` to `pages/admin/`
5. Move `GiftAidLog.jsx` to `pages/finance/`
6. Create `pages/officers/` and move `OfficerList.jsx` there
7. Move `PublicLinks.jsx` to `pages/settings/`
8. Update all import paths in:
   - `App.jsx` (route definitions)
   - The moved files themselves (their `../../lib/` and `../../components/` imports
     stay the same depth since they're still 2 levels deep in pages/)
   - `AuditRecord.jsx` imports `auditHelpers.js` — update to `../../lib/auditHelpers.js`
   - `AuditLog.jsx` imports `auditHelpers.js` — update to `../../lib/auditHelpers.js`
9. Delete empty `pages/misc/` directory

**Testing:** Run `cd frontend && npm test`. Navigate to Audit Log, Data Backup,
Gift Aid Log, Officers, and Public Links in the browser.

---

### R8. Move calendar and team pages to their own directories

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

### R9. Extract shared Zod schemas on the backend

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

### R10. Shared UI primitives for repeated Tailwind patterns

**Problem:** The primary button class string `bg-blue-600 hover:bg-blue-700
disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium
transition-colors` appears **116 times across 68 files**. `const inputCls` is
redefined locally in **31 files** with near-identical values.

**Implementation steps:**

1. Create `frontend/src/components/ui/Button.jsx`:
   ```jsx
   const VARIANTS = {
     primary: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white',
     danger:  'bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white',
     secondary: 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700',
   };
   export default function Button({ variant = 'primary', className = '', ...props }) {
     return <button className={`${VARIANTS[variant]} rounded px-5 py-2 text-sm font-medium transition-colors ${className}`} {...props} />;
   }
   ```
2. Create `frontend/src/components/ui/Input.jsx` exporting the `inputCls` string
   as a constant (or a component if preferred)
3. Incrementally adopt — don't do a big-bang replacement. Start with new code and
   migrate existing files opportunistically (e.g. when touching a file for other reasons)

**Files to create:**
- `frontend/src/components/ui/Button.jsx`
- `frontend/src/components/ui/Input.jsx`

**Testing:** Run `cd frontend && npm test` after each batch of file migrations.

---

### R11. Rename PF → ProtectedFeatureRoute in App.jsx

**Problem:** `PF` is defined at `App.jsx:111` and used 42 times. The abbreviation
gives no indication of what it does.

**Implementation steps:**

1. Rename the function definition at line 111:
   `function PF(` → `function ProtectedFeatureRoute(`
2. Replace all 42 JSX usages: `<PF ` → `<ProtectedFeatureRoute ` and
   `</PF>` → `</ProtectedFeatureRoute>`
3. Use the Edit tool with `replace_all: true`

**Files to modify:**
- `frontend/src/App.jsx` only

**Testing:** Run `cd frontend && npm test`.

---

### R12. Add missing backend tests

**Problem:** These route files have no corresponding test file:

| Route file | Lines | Risk |
|-----------|-------|------|
| `backup.js` | 1,663 | **High** — backup/restore is critical |
| `portal.js` | 1,545 | **High** — member-facing portal |
| `public.js` | 1,153 | **High** — public joining flow |
| `teams.js` | 1,033 | **Medium** — largely mirrors groups.js |
| `email.js` | 499 | **Medium** — SendGrid integration |
| `settings.js` | ~320 | **Low** — simple CRUD |
| `venues.js` | ~100 | **Low** — simple CRUD |
| `addressExport.js` | ~100 | **Low** — query + formatting |
| `customFields.js` | ~50 | **Low** — simple CRUD |
| `eventTypes.js` | ~80 | **Low** — simple CRUD |
| `privileges.js` | ~20 | **Low** — read-only |
| `system.js` | ~200 | **Low** — system admin only |

**Recommended order:** backup → portal → public → teams → email → settings

**Implementation:** Follow the existing test pattern in `backend/src/__tests__/`:
- Import `supertest` and `{ describe, it, expect, vi, beforeEach }` from `vitest`
- Mock `../utils/db.js` (tenantQuery), `../utils/audit.js` (logAudit),
  `../utils/redis.js`, etc.
- Use the `helpers.js` file for `mockUser()`, `ALL_PRIVS`, etc.
- See `groups.test.js` or `finance.test.js` as templates

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
