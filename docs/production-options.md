# Beacon2 — Production Options

**Date:** 2026-03-27
**Status:** Draft — for internal decision-making
**Audience:** Developer/owner

---

## 1. Context

Beacon2 is a multi-tenant membership management system for u3a organisations.
The current implementation is a proof-of-concept deployed on Render (backend +
PostgreSQL) and Vercel (React SPA frontend), both on free tiers.

**Target production scale:**

| Metric | Value |
|--------|-------|
| Tenants (u3as) | 1,000–2,000 |
| Members per tenant | 100–3,000 |
| Total members | ~450,000 |
| System users per tenant | ~50 |
| Portal users per tenant | ~300 |
| Total concurrent system users (estimate) | 5,000–10,000 |
| Total portal users (estimate) | 300,000–600,000 |

**External service dependencies:**
- SendGrid (email)
- PayPal (payments — implemented)
- Stripe, GoCardless (payments — not yet implemented)
- File/photo storage (not yet implemented)

---

## 2. Current Architecture Summary

```
  Vercel (free)              Render (free)              Render Postgres (free)
  ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
  │  React SPA   │──HTTPS──▶│  Express API  │──────────▶│  PostgreSQL  │
  │  Vite build  │           │  Node 20      │           │  15+         │
  └──────────────┘           │  JWT auth     │           │  schema/     │
                             │  Prisma ORM   │           │  tenant      │
                             └──────────────┘           └──────────────┘
```

**Key characteristics:**
- Schema-per-tenant isolation (each u3a gets a `u3a_<slug>` PostgreSQL schema)
- JWT access tokens (15 min) + refresh tokens (30 days, httpOnly cookie)
- Redis optional (currently disabled) for session invalidation
- In-memory file generation (Excel, PDF exports)
- Rate limiting via express-rate-limit (IP-based)
- CI pipeline (GitHub Actions) with unit tests; E2E tests via Playwright

---

## 3. Key Decisions

### 3.1 Tenant Isolation: Schema-per-tenant vs Row-level (tenant_id FK)

This is the most consequential architectural decision. Both approaches are
viable at your scale; the trade-offs are significant.

#### Option A: Keep schema-per-tenant (current)

**How it works:** Each tenant gets its own PostgreSQL schema (`u3a_oxford`,
`u3a_cambridge`). Queries use `SET search_path` to isolate data.

| Pros | Cons |
|------|------|
| Strong isolation — impossible to accidentally leak data across tenants | ~33 tables × 2,000 tenants = 66,000 tables; PostgreSQL catalog bloat |
| Easy per-tenant backup/restore | Migrations must run against every schema (startup time grows linearly) |
| Simple queries — no `WHERE tenant_id = ?` everywhere | Connection pooling is harder (search_path must be set per query) |
| Can drop a tenant's schema cleanly | Some managed PostgreSQL services struggle above ~10,000 tables |
| Each tenant can be independently sized | Aggregate cross-tenant queries (reporting) are expensive |

**Mitigation for catalog bloat:** PostgreSQL handles 66K tables if you have
enough shared_buffers and keep autovacuum tuned. Citus or partitioning is not
needed at this table count. But you'd want to test at scale (create 2,000
empty schemas and measure startup/query planning time).

**Verdict:** Viable for production. The main risk is migration time at 2,000
tenants and tooling support. Worth load-testing before committing.

#### Option B: Move to row-level isolation (tenant_id FK)

**How it works:** All tenants share one set of 33 tables. Every table gets a
`tenant_id` column. All queries filter by tenant_id. Row-Level Security (RLS)
policies in PostgreSQL can enforce isolation at the database level.

| Pros | Cons |
|------|------|
| Single set of tables — standard tooling, easy migrations | Every query must include tenant_id (risk of forgetting = data leak) |
| Better connection pooling (no schema switching) | RLS adds query overhead (~5-10%) |
| Cross-tenant reporting is trivial | Cannot drop a single tenant's data without DELETE + VACUUM |
| Scales to 100K+ tenants without catalog issues | Harder to do per-tenant backup/restore |
| More hosting options (works well with serverless DB) | Significant migration effort from current schema |

**Migration effort:** High. Every table needs `tenant_id`, every query needs
updating, every test needs adjusting. Estimate 2–4 weeks of focused work,
plus thorough testing.

**Verdict:** Better long-term scalability, but the migration cost is real.
Only worth doing if you expect to hit catalog limits or need serverless DB
options.

#### Recommendation

**Stay with schema-per-tenant for now**, but run a scale test early: spin up
2,000 empty tenant schemas and measure startup time, query planning, and
memory usage. If the results are acceptable, proceed. If not, plan the
migration before going live.

---

### 3.2 Database Hosting

#### Option A: Render Managed PostgreSQL (current, upgraded)

| Tier | RAM | Storage | Connections | Cost/month |
|------|-----|---------|-------------|------------|
| Starter | 1 GB | 16 GB | 97 | ~$7 |
| Standard | 4 GB | 64 GB | 397 | ~$30 |
| Pro | 8 GB | 128 GB | 497 | ~$75 |

- Simple (already integrated), same-region networking.
- Automated daily backups on paid tiers.
- No read replicas on lower tiers.

#### Option B: AWS RDS / Aurora PostgreSQL

| Aspect | Details |
|--------|---------|
| Cost | db.t4g.medium (~$70/mo) + storage |
| Pros | Read replicas, point-in-time recovery, Multi-AZ failover, mature tooling |
| Cons | More complex setup, cross-provider networking if backend stays on Render |

#### Option C: Supabase / Neon (serverless PostgreSQL)

| Aspect | Details |
|--------|---------|
| Cost | Free tier → ~$25/mo (Pro) |
| Pros | Built-in connection pooling (PgBouncer), branching (Neon), auto-scaling |
| Cons | Schema-per-tenant + search_path may conflict with connection pooling; need to test |

#### Recommendation

**Start with Render Standard/Pro** for simplicity. If you need read replicas or
Multi-AZ failover, migrate to **RDS**. Serverless options are attractive but need
validation with the schema-per-tenant model.

**Critical regardless of choice:**
- Automated daily backups with at least 7-day retention
- Point-in-time recovery capability
- Connection pooling (PgBouncer or similar) — essential at 2,000 tenants

---

### 3.3 Backend Hosting & Scaling

#### Option A: Render (current, upgraded)

- **Starter ($7/mo):** 512 MB RAM, no auto-sleep — minimum viable.
- **Standard ($25/mo):** 2 GB RAM, better for in-memory PDF/Excel generation.
- **Pro ($85/mo):** 4 GB RAM, horizontal scaling available.
- Can scale to multiple instances behind Render's load balancer.
- Zero-downtime deploys built in.

#### Option B: AWS ECS / Fargate (containerised)

- Pack the Express app in Docker (straightforward — no Dockerfile exists yet).
- Auto-scaling based on CPU/memory.
- ~$30–100/mo depending on task size and count.
- More operational overhead, but more control.

#### Option C: AWS Lambda / serverless

- **Not recommended** for this app. Schema-per-tenant requires persistent
  connections; cold starts + connection limits would be problematic. The
  in-memory PDF generation also doesn't suit Lambda's 10-second-typical
  response pattern.

#### Recommendation

**Render Standard** to start. Add a second instance when load requires it.
Move to **ECS/Fargate** only if you need fine-grained auto-scaling or want
to consolidate on AWS.

---

### 3.4 Frontend Hosting

#### Option A: Vercel (current)

- Free tier is generous for SPAs (100 GB bandwidth/mo).
- Pro ($20/mo) adds team features, more bandwidth, analytics.
- Automatic preview deploys per branch.
- Edge network (fast globally).

#### Option B: Cloudflare Pages

- Very generous free tier (unlimited bandwidth).
- Global edge network, often faster than Vercel.
- Free custom domains + SSL.

#### Option C: Serve from backend (SSR or static)

- Eliminates CORS complexity (same origin).
- But loses edge caching, preview deploys, and separation of concerns.
- **Not recommended** unless you have a strong reason.

#### Recommendation

**Stay on Vercel** (or switch to Cloudflare Pages for cost savings). The SPA
model works well. No need for SSR — this is an authenticated app, not a
content site that needs SEO.

**Consider:** Custom domain (e.g., `app.beacon2.org.uk`) rather than the
default Vercel URL. Vercel supports this on free and paid tiers.

---

### 3.5 File/Photo Storage

Photos and attachments need persistent storage. In-memory won't scale.

#### Option A: AWS S3

- Industry standard, ~$0.023/GB/month.
- Pre-signed URLs for secure upload/download (no files through the API server).
- Lifecycle rules for cleanup.
- SDK: `@aws-sdk/client-s3`.

#### Option B: Cloudflare R2

- S3-compatible API, **no egress fees** (significant saving at scale).
- ~$0.015/GB/month storage.
- Slightly less mature tooling.

#### Option C: Render Object Storage

- Simpler integration (same platform), but less mature than S3/R2.

#### Storage estimate

| Item | Per tenant | 2,000 tenants | Monthly cost (S3) |
|------|-----------|---------------|-------------------|
| Member photos (avg 200KB × 1,000) | 200 MB | 400 GB | ~$9 |
| Documents/attachments | 100 MB | 200 GB | ~$5 |
| **Total** | **300 MB** | **600 GB** | **~$14** |

#### Recommendation

**Cloudflare R2** for cost (no egress fees), or **S3** for ecosystem maturity.
Use pre-signed URLs so files never flow through the API server. Namespace
uploads by tenant slug: `u3a_oxford/photos/member_123.jpg`.

---

### 3.6 Caching & Session Management

The current POC has Redis as optional (disabled). Production needs it.

#### What Redis would handle:
1. **Session invalidation** — already coded but disabled. When a user's roles
   change, invalidate their JWT immediately rather than waiting for expiry.
2. **Rate limiting** — currently in-memory (resets on restart, not shared
   across instances). Redis-backed rate limiting works across multiple
   backend instances.
3. **API response caching** — tenant settings, privilege lookups, and other
   slow-changing data.

#### Options:

| Provider | Cost | Notes |
|----------|------|-------|
| Render Redis | $7/mo (256 MB) | Same platform, simple |
| AWS ElastiCache | ~$15/mo (t4g.micro) | More control, Multi-AZ |
| Upstash (serverless Redis) | Free tier → $10/mo | Pay-per-request, good for bursty workloads |

#### Recommendation

**Render Redis ($7/mo)** to start — simplest integration, already coded.
Upgrade to ElastiCache if you move backend to AWS.

---

### 3.7 Payment Integrations

Current: PayPal (implemented). Needed: Stripe, GoCardless.

#### Architecture considerations:
- **Webhooks** are essential. All three services send async payment
  notifications. The backend needs reliable webhook endpoints with:
  - Signature verification (each provider has its own scheme)
  - Idempotent processing (webhooks can be delivered multiple times)
  - A webhook event log table (for debugging and audit)
- **Tenant routing:** Webhook URLs should include the tenant slug
  (e.g., `/webhooks/stripe/u3a_oxford`) so the backend knows which
  schema to write to.
- **PCI compliance:** Never store card numbers. Use Stripe's hosted
  checkout or PayPal's redirect flow. GoCardless handles Direct Debit
  similarly. The current PayPal approach appears correct on this front.

#### Recommendation

Add a `webhook_events` table to the tenant schema for idempotent processing
and audit. Implement Stripe and GoCardless as separate route modules
following the existing PayPal pattern.

---

### 3.8 Monitoring, Logging & Alerting

The current setup has console logging and a health endpoint. Production needs more.

#### Logging

| Option | Cost | Notes |
|--------|------|-------|
| **Render logs** (built-in) | Free (7 days) | Basic, no search |
| **Datadog** | ~$15/mo per host | Full APM, log management, dashboards |
| **Grafana Cloud** | Free tier (50 GB logs/mo) | Good balance of features and cost |
| **AWS CloudWatch** | ~$5–15/mo | If you move to AWS |

**Minimum:** Structured JSON logging (replace `console.log` with a logger
like **pino** or **winston**) so logs are searchable.

#### Uptime monitoring

| Option | Cost |
|--------|------|
| UptimeRobot | Free (5-min checks) |
| Better Uptime / Pagerduty | $10–30/mo |

#### Error tracking

| Option | Cost |
|--------|------|
| **Sentry** | Free tier (5K events/mo) → $26/mo |

**Recommended minimum for production:**
- Sentry (frontend + backend error tracking)
- Structured logging with pino
- UptimeRobot or similar for the health endpoint
- Render's built-in metrics for CPU/memory

---

### 3.9 CI/CD & Deployment Pipeline

Current: GitHub Actions runs unit tests on push. Render/Vercel auto-deploy
from main. No staging environment.

**Production needs:**

1. **Staging environment** — a separate Render instance + database that
   mirrors production. Deploy to staging first, run E2E tests, then promote.
2. **Database migration safety** — the current "run all DDL on every startup"
   approach works but is risky at scale. Consider:
   - A migration version table to track what's been applied
   - Running migrations as a separate step (not on app startup)
   - Blue-green deployments to avoid downtime during migrations
3. **Rollback strategy** — if a deploy breaks, you need to be able to
   revert. Render supports instant rollback to previous deploy.

#### Recommended pipeline:

```
Push to claude/* branch
  → CI: unit tests + lint
  → Merge to main
    → Auto-deploy to staging
    → Run E2E tests against staging
    → Manual promotion to production (or auto after E2E pass)
```

---

### 3.10 Security Hardening

The POC has good foundations (Helmet, CORS, rate limiting, bcrypt, JWT
rotation). For production, additionally:

| Area | Current | Production |
|------|---------|------------|
| **HTTPS** | Via Render/Vercel (automatic) | ✅ Already handled |
| **Rate limiting** | In-memory, per-instance | Redis-backed, shared across instances |
| **CSRF** | SameSite cookie + CORS | Sufficient for API-only backend |
| **Input validation** | Zod on most routes | Audit all routes for completeness |
| **SQL injection** | Parameterised queries + schema validation | ✅ Already handled |
| **Secrets management** | Render env vars | Consider AWS Secrets Manager if moving to AWS |
| **Dependency scanning** | npm audit (manual) | Add `npm audit` to CI, consider Dependabot |
| **Penetration testing** | None | Commission before launch |
| **GDPR compliance** | Audit log exists | Add data export, data deletion, consent tracking |
| **WAF** | None | Consider Cloudflare in front of Render |

---

## 4. Cost Estimates

### Minimal production (handles ~500 tenants comfortably)

| Component | Provider | Tier | Cost/month |
|-----------|----------|------|------------|
| Backend | Render | Standard | $25 |
| Database | Render | Standard | $30 |
| Frontend | Vercel | Free | $0 |
| Redis | Render | Starter | $7 |
| File storage | Cloudflare R2 | — | ~$5 |
| Email | SendGrid | Free (100/day) | $0 |
| Monitoring | Sentry free + UptimeRobot | — | $0 |
| **Total** | | | **~$67/mo** |

### Full production (1,000–2,000 tenants)

| Component | Provider | Tier | Cost/month |
|-----------|----------|------|------------|
| Backend (×2 instances) | Render | Pro | $170 |
| Database | Render or RDS | Pro / db.t4g.medium | $75–100 |
| Frontend | Vercel | Pro | $20 |
| Redis | Render | Standard | $15 |
| File storage | Cloudflare R2 | — | ~$15 |
| Email | SendGrid | Pro (100K/mo) | $90 |
| Monitoring | Sentry + Grafana | — | $40 |
| Staging env | Render | Starter + Starter DB | $40 |
| **Total** | | | **~$465–490/mo** |

### Notes on cost
- These are infrastructure costs only — no developer time, support, or licensing.
- SendGrid cost depends heavily on email volume. 2,000 u3as sending even
  modest newsletters could generate 500K+ emails/month ($200+/mo).
- PayPal/Stripe/GoCardless charge per-transaction fees (not infrastructure cost).

---

## 5. Prioritised Roadmap

If moving towards production, here's a suggested order:

### Phase 1 — Foundation (before any real tenants)
1. ✅ Scale test: create 2,000 empty tenant schemas, measure performance
2. Upgrade Render to paid tiers (backend + database)
3. Enable Redis for session invalidation and rate limiting
4. Add structured logging (pino)
5. Add Sentry for error tracking
6. Set up automated database backups
7. Set up a staging environment
8. Add `npm audit` and Dependabot to CI

### Phase 2 — Core production features
9. Implement file/photo storage (R2 or S3 with pre-signed URLs)
10. Implement Stripe and GoCardless integrations
11. Add GDPR data export and deletion features
12. Commission a penetration test
13. Custom domain setup
14. Add structured health checks (database connectivity, Redis, external services)

### Phase 3 — Scale & resilience
15. Connection pooling (PgBouncer) in front of PostgreSQL
16. Multi-instance backend with shared Redis state
17. Database read replica for reporting queries
18. CDN / WAF (Cloudflare) in front of the API
19. Migration versioning system (replace startup-DDL approach)
20. Blue-green deployment pipeline

---

## 6. Open Questions

- **Backup granularity:** Should individual tenants be able to request
  data exports, or is a whole-database backup sufficient?
- **Tenant onboarding:** Currently manual (seed script). At 2,000 tenants,
  need a self-service or semi-automated onboarding flow.
- **SLA expectations:** What uptime target? 99.9% (8.7h downtime/year)
  requires Multi-AZ database and multiple backend instances.
- **Data migration:** Will existing Beacon users migrate data from the
  original system? If so, an import pipeline is needed.
- **White-labelling:** Do individual u3as need custom branding, subdomains,
  or is a single shared UI sufficient?
