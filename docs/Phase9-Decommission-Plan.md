# Phase 9 — Render/Vercel Decommission Plan

> **Status: PLANNING — not yet executed.** Production cut over to the
> OVHcloud VPS on 2026-08-14 (`docs/DEPLOY-VPS.md`); Phases 0–8 of
> `beacon2026-ovhcloud-vps-recommendation.md` are done. This is Phase 9 —
> the last one. It is deliberately not a same-day follow-on: the
> recommendation doc calls for "a clean parallel window (a week is ample at
> POC scale)" before cancelling Render/Vercel, specifically so a problem
> discovered on the VPS after the fact still has a working fallback to fall
> back to. **Do not action §3 below before the exit criteria in §1 are met
> and Peter has confirmed a go-ahead** — cancelling paid services and
> dropping a database are not reversible in the way a `git revert` is.

---

## 1. Exit criteria — all must be true before proceeding to §3

| # | Criterion | Status as of 2026-08-15 |
|---|-----------|--------------------------|
| 1 | Parallel-run window elapsed (≥1 week from 2026-08-14 go-live) | **Not yet — earliest 2026-08-21.** Only 1 day elapsed. |
| 2 | No unresolved production incident traced to the VPS move | ✅ none known — see `project_beacon2026_vps_migration` memory for the 3 real bugs found, all fixed same-session |
| 3 | Nightly backup cron running and verified (`crontab -l` on the VPS, `deploy/backup.sh` output) | ✅ confirmed 2026-08-14 |
| 4 | Off-box backup pull to the laptop working (`Beacon2026-PullBackups` scheduled task) | ✅ confirmed 2026-08-14 |
| 5 | A **real** restore drill performed (not just a script that's never been run) | ✅ performed 2026-08-14 (`deploy/restore.sh`) |
| 6 | Full E2E suite green against the VPS | ✅ 164/164, run `31835461807`, 2026-08-14 |
| 7 | E2E CI no longer points at production | ✅ repointed to `https://staging.u3abeacon2.uk` 2026-08-15 |
| 8 | Staging environment usable as an independent smoke-test target, in case Render's removal itself needs verifying against something other than prod | ✅ live 2026-08-15 |
| 9 | Peter has explicitly confirmed the cutover date | ⬜ not yet asked |

**Recommendation: earliest sensible date is 2026-08-21** (one full week from
go-live), assuming no incident resets the clock. Re-run this table before
proceeding — a criterion can regress (e.g. a new incident) between when this
plan is read and when it's acted on.

---

## 2. What decommissioning does *not* mean

Per the recommendation doc's own instruction (§9, Phase 9): **`render.yaml`
and `frontend/vercel.json` stay in the repo**, not deleted. beacon2026 is a
public repo aimed at u3a volunteers who may not have server/SSH access — the
free-tier, no-command-line Render+Vercel path documented in `DEPLOYMENT.md`
remains a legitimate, supported deployment option for *them*, even though
*this* deployment (the one Peter runs) has moved off it. Decommissioning is
about cancelling the live Render/Vercel **services** tied to this specific
deployment, not removing the documented path from the codebase.

### Repo housekeeping (safe to do now, independent of the exit criteria)

Not yet done — the recommendation doc asked for a header comment marking
these files as the documented fallback, which was never added:

- [ ] `render.yaml` — add a header comment (YAML supports `#`) noting it's
      the documented no-command-line fallback path (`DEPLOYMENT.md`), not
      what production runs on.
- [ ] `frontend/vercel.json` — pure JSON, no comment syntax available without
      risking an unrecognised-key validation error from Vercel. Add the
      equivalent note to `DEPLOYMENT.md` itself instead (which already
      opens with a "this is not what production runs on" banner — check
      it still reads correctly once Render/Vercel are actually cancelled,
      e.g. "if you want a live comparison, see the VPS at
      beacon2026.u3abeacon2.uk" language may need adjusting to past tense).

This can be done in its own PR, today, without touching any live service —
recommend doing it now so it's not forgotten once the actual cutover happens
and attention moves elsewhere.

---

## 3. Decommission steps (do not run before §1 is satisfied and confirmed)

### 3.1 Final data check

Confirm no tenant/member data has been created on Render since the 2026-08-14
migration dump (there shouldn't be any real traffic hitting it, but check) —
if there is, decide whether it needs migrating across before cutting over,
since this is the last chance.

```bash
# Against Render's External Database URL, read-only:
docker run --rm postgres:18-alpine psql "<render-external-database-url>" \
  -c "SELECT slug, created_at FROM sys_tenants ORDER BY created_at DESC LIMIT 5;"
```

### 3.2 Take a final Render backup, off-platform

Belt-and-braces even though the VPS already has the authoritative copy:

```bash
docker run --rm postgres:18-alpine pg_dump -Fc "<render-external-database-url>" \
  > render-final-decommission-$(date -u +%Y%m%d).dump
```
Store it alongside the existing backup set (`C:\Claude\Beacon2026-ops\` or
wherever the off-box pulls land) — see `project_beacon2026_vps_migration`
memory for the exact path — then it can be deleted from Render itself.

### 3.3 Cancel Render services

Render dashboard → `beacon2026-backend` service → Settings → Delete Web
Service. Then → `beacon2026-db` (or its `beacon2_a89s` legacy name, per
`KNOWN-ISSUES.md` → Render/Deployment) → Settings → Delete Database.
**These are separate deletions** — deleting the web service does not delete
the Postgres instance, and Render bills them independently.

### 3.4 Vercel — delete or hold

Two options, per the recommendation doc's own framing (§9): delete the
Vercel project outright, or leave it as a static holding page. A holding
page costs nothing on Vercel's free tier and gives anyone who still has the
old `beacon2026.vercel.app` bookmarked a pointer to the real URL, rather than
a dead link. **Ask Peter which he wants** before acting — this is a
judgement call about anyone external's UX, not a technical decision.

### 3.5 Update docs to reflect the cancellation

- `README.md`, `beacon2026 Project Definition.md`, `docs/DEPLOY-VPS.md`:
  change "Render+Vercel are being kept running in parallel for a safety
  window" language (added in the 2026-08-14 CHANGELOG entry and carried into
  the Project Definition doc) to past tense — the window is over.
- `beacon2026-ovhcloud-vps-recommendation.md` (outside this repo, PDC notes
  folder): update the top status line to **"EXECUTED 2026-08-14, staging
  2026-08-15, Render/Vercel decommissioned <date>."** — all 9 phases done.
- `CHANGELOG.md`: add a `### Removed` entry recording the date and that
  `render.yaml`/`frontend/vercel.json` remain in the repo as a documented
  fallback path, not deleted.
- `KNOWN-ISSUES.md` → Render/Deployment section: the historical `[FIXED]`/
  `[ACCEPTED]` entries there stay (they're about problems hit while Render
  was live, kept for the numbered-reference reason stated at the top of the
  file) — no change needed there beyond this plan's own status line.

---

## 4. Rollback if something goes wrong *after* decommissioning

There is no fast rollback once Render/Vercel are cancelled — recreating a
Render service from `render.yaml` and a fresh Postgres instance is possible
(the blueprint is still in the repo) but means restoring from the final dump
in §3.2 and re-issuing fresh secrets, not a quick toggle. This is the real
reason for the parallel-run window in §1: the cost of being wrong is high
enough that "wait and confirm nothing broke" is cheaper than "move fast and
recreate later." If the VPS has been stable for the full window with no
incident, this risk is low — but it is not zero, which is why criterion #9
(explicit confirmation) exists.
