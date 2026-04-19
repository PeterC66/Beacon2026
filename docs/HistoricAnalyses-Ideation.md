# Historic analyses on Beacon2 data — ideation

> Scoping / ideation document. Covers **membership** and **finance** only.
> Per-u3a focus, with a short section at the end on national / regional possibilities.
> No code — this is an idea document to inform later build decisions.

---

## 1. Context and data constraints

A few things shape what's realistic:

- **Partial history for ex-members.** Most u3as will delete lapsed members after a
  short retention window unless they claim Gift Aid. That means long-run
  **retention and cohort analyses will be biased** towards GA-opted members and
  the few years of still-active lapsed records. Any analysis that needs "who left
  and when" must either be done forward-only in Beacon2, or lean on aggregate
  snapshots (see §5).
- **Finance history is cleaner.** Transactions persist even when a member is
  deleted (member reference becomes a name on the row), so multi-year finance
  trends are largely intact — though member-linked analyses (e.g. "fees paid per
  member") lose resolution once the member is deleted.
- **Legacy imports.** Many u3as will import 5–10+ years of Beacon data, so the
  starting point is usually not a blank slate.
- **Audit log** is another under-used historic source — it can tell you when
  statuses changed, who edited what, when Gift Aid was claimed, etc. — but only
  from the Beacon2 era onwards.

---

## 2. Membership analyses

### 2.1 Headline trends
- **Total membership over time** (month-end or year-end snapshots), split by
  status (Current / Applicant / Honorary / Lapsed).
- **Joiners / renewers / non-renewers per year** — simple three-line chart; also
  useful as a stacked bar.
- **Net growth rate** (joiners − lapses) with YoY change.
- **Seasonality of joining** — which months attract new members; useful for
  timing open days and publicity.

### 2.2 Retention and churn
- **Year-on-year renewal rate**, overall and by member class.
- **Cohort retention curves** — "of members who joined in 2020, what % are still
  current?" (limited by deletions; only reliable for GA-opted members or for the
  most recent cohorts).
- **First-year drop-off rate** — a leading indicator of induction / onboarding
  health.
- **Tenure distribution of current members** — how many are in their 1st, 2nd,
  5th, 10th+ year.

### 2.3 Demographics and composition
- **Class mix over time** — share of Single / Joint / Honorary / Associate / etc.
- **Joint-membership share trend.**
- **Gift Aid opt-in rate trend** (share of eligible members declaring GA).
- **Age distribution / age at joining** (only feasible if DOB captured — see §5).
- **Geographic distribution** — member counts by town/postcode district, change
  over time; useful for targeted publicity.

### 2.4 Group participation (bridges membership ↔ groups)
- **% of members in at least one group** (engagement KPI).
- **Average groups per member**, and the "super-joiner" long tail.
- **Group popularity trends** — fastest-growing, fastest-shrinking, longest
  waiting lists.
- **Waiting-list backlog over time** — diagnostic for capacity planning.
- **Faculty mix** — where is interest shifting (e.g. arts vs. physical activity).
- **Leader load** — members acting as leaders across multiple groups; risk
  concentration.

### 2.5 Portal and online-joining trends
- **Online joiners vs. manually added** (split over time).
- **Online renewal uptake** as a share of total renewals.
- **Portal activity** (logins, personal-details updates) — only going forward,
  from audit log.

---

## 3. Finance analyses

### 3.1 Income and expenditure
- **Annual and monthly I&E** — stacked bars or line charts.
- **By category trends** — which income categories are growing/shrinking (subs,
  donations, events, speaker fees, refreshments).
- **By account** — useful when there are multiple bank / PayPal / cash accounts.
- **Income mix** — share of membership fees vs. events vs. donations.

### 3.2 Cash and reserves
- **Account balance over time** (month-end snapshots per account, and total).
- **Reserves vs. annual running cost ratio** — governance-useful KPI (e.g.
  "we hold 2.3 years of expenditure").
- **Cashflow calendar** — when in the year does cash peak and trough (helps plan
  large payments).

### 3.3 Membership fee income
- **Fee income per year, by class** — direct from finance transactions linked to
  member class.
- **Average fee per member** — total sub income ÷ members (revealing if
  concessions are eroding income).
- **Fee-setting impact** — year of fee change vs. income and membership change.

### 3.4 Gift Aid
- **GA-eligible income, claimed income, and claim value over time.**
- **Unclaimed GA** lurking in the system (eligible but not yet marked claimed) as
  a current-state alert.
- **Effective GA uplift** — claimed GA ÷ membership income.

### 3.5 Events and groups
- **Event profitability** — income − costs per event, by event type, over time.
- **Per-group ledger solvency** — groups consistently in deficit or building
  large surpluses.
- **Largest-surplus and largest-deficit groups** (year-end leaderboard).

### 3.6 Operational finance
- **Pending → cleared lag** per account (how long reconciliation takes).
- **Refund rate** — value and count of refunds as a share of income.
- **Reconciliation health** — uncleared transactions older than N days.

---

## 4. Cross-module analyses (membership × finance)

- **Revenue per member** and **per active (group-participating) member.**
- **Contribution per member class** (fees collected net of any class-specific
  costs).
- **Lifetime financial contribution** for long-tenured members (GA-opted only,
  due to the deletion issue).
- **Cost-to-serve** for a member (allocated share of running costs ÷ members).

---

## 5. Data fields that would materially improve the analyses

Organised by what unlocks which analysis.

### 5.1 Member record — high value
- **`date_of_birth`** (or at least age band at joining) — unlocks age
  demographics, age-at-joining, and cohort analysis that isn't distorted by
  deletion.
- **`original_join_date`** preserved across lapses and re-joins — distinct from
  the "current membership started" date. Critical for true tenure analysis.
- **`leave_reason`** (free-text or coded: moved / ill-health / deceased / lost
  interest / cost / other) — captured at lapse. Single most useful governance
  data point u3as currently lack.
- **`how_heard_about_u3a`** at joining (coded: friend / website / leaflet /
  event / press / other) — lets publicity spend be evaluated.
- **`gender`** (optional, self-declared) — for national reporting comparisons.

### 5.2 Anonymised membership history snapshot
Rather than losing ex-member data when a u3a deletes them for privacy, keep an
**annual anonymised aggregate table** — counts by (year, class, status,
age-band, tenure-band, town-district). No PII, kept indefinitely. This is the
single biggest unlock for long-run trend analysis under the current deletion
practice, and it's cheap to build.

### 5.3 Groups
- **Historic group size snapshots** (end-of-year member count, waiting-list
  count, leader count) — so group trends survive roster churn.
- **Group close date / archived date** — to distinguish "group shrinking" from
  "group closed".

### 5.4 Finance
- **`financial_year`** denormalised on transactions (cheap) — avoids
  calendar/April-boundary arithmetic in every query.
- **`source`** on transaction (online / manual / import / renewal / joining) —
  already partly implicit, but a single field aids analysis.
- **Monthly account balance snapshots** (materialised) — queries over 10 years
  of transactions to reconstruct balances get slow; a snapshot table is trivial
  to maintain.

### 5.5 Events
- **`attendees_count`** snapshot on event close (not just live membership rows)
  — survives later edits.

---

## 6. Suggested reporting vehicles — which analysis suits which

| Vehicle | Best for | Examples |
|---|---|---|
| **Dashboard page (KPI tiles + sparklines)** | At-a-glance committee view; headline numbers with direction of travel | Total members, YoY renewal rate, cash reserves, GA claimed this year, net growth |
| **Dedicated chart pages** (time-series line / stacked bar) | Exploratory trend viewing; committee meeting visuals | Members by status over time, income by category, group popularity |
| **SQL Reports library** (existing infra, Excel download) | Detail-heavy, treasurer/secretary analyses; reproducible annual reports | Cohort retention, unclaimed GA detail, per-group ledger year compare, member list with tenure |
| **Scheduled email pack** (monthly/quarterly PDF to officers) | Passive governance oversight; drives committee attention without logins | "Committee Pack" — 1-page KPIs + 3 trend charts + alerts (e.g. reserves fell, waiting lists growing) |
| **Ad-hoc SQL editor** (site admin only) | One-off questions from treasurer / secretary | "Members in postcode BA2 who joined since 2022" |
| **Excel export on any analysis** | Treasurer / secretary further slicing | Every dashboard and chart page should have a "Download data" button |

### Recommended build order (if/when this is built)
1. Extend the **SQL Reports library** with a curated set of ~15 parameterised
   historic reports (cheapest win, uses existing infra).
2. Add a **Membership Dashboard** and **Finance Dashboard** page (KPI tiles +
   sparklines + 2–3 key charts each).
3. Add the **anonymised snapshot table** (§5.2) — without this, long-run
   membership analysis is permanently weakened.
4. Introduce **scheduled committee packs** as a later addition once the
   dashboards are stable.

---

## 7. National / regional reporting possibilities

Although out of primary scope, Beacon2's multi-tenant architecture makes
national/regional reporting natural, provided each u3a opts in:

- **Opt-in anonymised aggregate push** — each tenant periodically publishes a
  small aggregate document (member counts by class/status/age-band, income
  bands, group counts, GA uptake, retention rate) to a national endpoint. No PII
  leaves the tenant.
- **National dashboard** — total u3a membership across Beacon2 tenants; growth
  rate; fee-range distribution; GA uptake rate; group-participation rates.
  Useful for the Third Age Trust and for comparative benchmarking ("your
  retention is 78% vs. national 82%").
- **Regional trustee views** — same metrics filtered to a region, with per-u3a
  ranking (opt-in to being named).
- **Benchmark-back-to-u3a** — each u3a sees its own KPIs alongside regional /
  national medians as a context band on its dashboard. Powerful and low-risk
  because the u3a only ever sees aggregates about others.
- **Governance and privacy** — requires explicit per-u3a consent, a documented
  data-sharing agreement, clear aggregation thresholds (suppress cells < 5 to
  prevent re-identification), and a withdraw mechanism.
- **Data fields to add at national level** — a single `national_reporting_consent`
  flag per tenant, and a `nationalReportingSnapshot` job that runs the
  aggregation nightly.
