# Security Policy

beacon2026 is a multi-tenant web application that stores u3a member personal
data (names, contact details, membership and payment records). We take security
reports seriously and appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, report them privately through GitHub's security advisory workflow:

1. Go to the repository's **Security** tab.
2. Select **Report a vulnerability** (Advisories → Report a vulnerability).
3. Provide a clear description, including:
   - the affected area (endpoint, page, or module),
   - steps to reproduce or a proof of concept,
   - the impact you believe it has, and
   - any suggested remediation, if known.

If you are unable to use the GitHub advisory flow, you may open a minimal,
non-sensitive issue asking a maintainer to open a private channel — without
including any vulnerability details in that issue.

We aim to acknowledge a report within a few days and to keep you informed of
progress toward a fix. Please give us a reasonable opportunity to investigate
and remediate before any public disclosure.

## Supported scope

beacon2026 is a demonstration / portfolio project and is **not yet running in
production**. There is no released, supported version with a security-update
guarantee; fixes are applied to the `main` branch.

In scope:

- The beacon2026 backend (`backend/`) and frontend (`frontend/`) application code
  in this repository.
- Authentication, authorisation/privilege, multi-tenant isolation, and member
  data handling.

Out of scope:

- Third-party dependencies (please report those upstream; we track advisories
  via Dependabot).
- Original Beacon reference material under `docs/FromBeacon/`, which is not part
  of the running application (see `docs/FromBeacon/README.md`).
- Hosting-platform or infrastructure issues not caused by this code.

## Security status

This summarises the security work done so far, so anyone evaluating beacon2026 for
real use knows what has — and has not — been assured.

**Completed:**

- An internal security review covering authentication, authorisation/privilege
  checks, multi-tenant isolation, input validation, and member-data handling
  (archived at `docs/history/SECURITY-REVIEW.md`; tracked items in
  `KNOWN-ISSUES.md`).
- Security controls in the application: bcrypt password hashing, short-lived
  in-memory JWTs with httpOnly refresh cookies, account lockout and rate limiting
  on login (admin and portal), Zod validation on request bodies, parameterised
  SQL only, and per-tenant schema isolation.
- Automated dependency advisories via Dependabot.
- A published Content-Security-Policy (currently report-only in the POC — see
  [DEPLOYMENT.md](DEPLOYMENT.md) for enforcing it).

**Not yet done:**

- Independent third-party security audit or penetration test.
- A formal GDPR Data Protection Impact Assessment (DPIA).

**Before deploying with real member data, you should:**

1. Have a data-protection lead review GDPR obligations for your u3a (see below).
2. Enforce the Content-Security-Policy (steps in [DEPLOYMENT.md](DEPLOYMENT.md)).
3. Move off free tiers so automated backups and Redis-backed session
   invalidation are in place (see [DEPLOYMENT.md](DEPLOYMENT.md)).
4. Consider commissioning an independent security review.

## Handling of personal data (GDPR)

beacon2026 stores personal data about u3a members — names, contact details,
membership history, and payment records — so a u3a running it acts as a **data
controller** under UK GDPR. The application provides the building blocks for
compliance, but compliance itself is the operator's responsibility.

What the application provides:

- **Access control** — named privileges and roles limit who can see or change
  member data; an **audit log** records changes.
- **Data export** — members' data can be exported (subject-access / portability)
  via the backup/export features.
- **Retention** — a configurable deletion window for lapsed members
  (`deletion_years`).
- **Consent** — a GDPR cookie-consent dialog and a configurable privacy-policy
  link shown on public/portal pages.

What the operator must still do:

- Publish a privacy policy and lawful-basis statement for members.
- Put a data-processing agreement in place with the hosting providers
  (OVHcloud for the production VPS, plus SendGrid; Render/Vercel for the POC
  fallback path).
- Define and follow retention, breach-notification, and subject-rights
  procedures.

When reporting a vulnerability, please **do not include real member data** — use
synthetic or redacted examples when demonstrating an issue.
