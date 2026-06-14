# Security Policy

Beacon2 is a multi-tenant web application that stores u3a member personal
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

Beacon2 is a demonstration / portfolio project and is **not yet running in
production**. There is no released, supported version with a security-update
guarantee; fixes are applied to the `main` branch.

In scope:

- The Beacon2 backend (`backend/`) and frontend (`frontend/`) application code
  in this repository.
- Authentication, authorisation/privilege, multi-tenant isolation, and member
  data handling.

Out of scope:

- Third-party dependencies (please report those upstream; we track advisories
  via Dependabot).
- Original Beacon reference material under `docs/FromBeacon/`, which is not part
  of the running application (see `docs/FromBeacon/README.md`).
- Hosting-platform or infrastructure issues not caused by this code.

## Handling of personal data

Because Beacon2 processes member PII, please **do not include real member data**
in any vulnerability report. Use synthetic or redacted examples when
demonstrating an issue.
