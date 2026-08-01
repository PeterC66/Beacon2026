# `docs/FromBeacon/` — original Beacon reference material

This directory holds selected artefacts from the original u3a **Beacon** system,
kept **strictly as reference material** while building beacon2026. They are **not**
part of the beacon2026 application, are not imported or executed by it, and are not
covered by the beacon2026 `LICENSE`.

## Copyright and status

All material in this directory remains the property of its respective copyright
holders. beacon2026:

- makes **no claim of ownership** over any of this material;
- makes **no claim of any right to redistribute** it;
- includes only what is genuinely needed **only as reference**, not as a basis
  for copying original code or content.

If any rights holder would prefer this material not be present in the
repository, it will be removed on request (see `SECURITY.md` / repository
contact).

**`privileges.php` and `styles.css` removed 2026-08-01.** These were original
Beacon source files carrying the notice *"This script is Copyright John
Franklin for all content as at 1st February 2017. © John Franklin 2017. The
Third Age Trust is permitted to use and modify the script according to the
terms of the Software Licence Agreement dated 7th February 2017."* — a licence
that runs to the Third Age Trust, not to this project. The facts they
documented (Beacon's internal privilege/audit numeric codes, needed to
interpret Beacon export files) have already been independently re-expressed in
beacon2026's own code (`backend/src/seed/privilegeResources.js`,
`backend/src/routes/backup/restore.js`) using original naming and structure.
With that extraction complete, there was no remaining reason to host Franklin's
actual copyrighted files, verbatim and publicly, in this repo.

**`202603170140_St Ives Cambridge Demo24 u3abackup.xlsx` and
`Gift-Aid-Schedule-Excel.ods` removed 2026-08-01.** These had served their
purpose as format references during development; there was no ongoing need to
keep hosting them.

## Contents

| File | What it is |
|------|------------|
| `Cookie Control text.png` | Screenshot of the original Beacon's Cookie Control panel. Not imported or referenced by any beacon2026 code — kept only as a documentation reference. |

## Why keep it here

beacon2026 is an independent reproduction; these files document *what the original
behaved like* so the reproduction can be faithful without copying the original
implementation. Treat everything here as read-only reference, never as code to
lift into beacon2026.
