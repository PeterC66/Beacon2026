# Enabling Beacon2 users to edit the u3a website — options for management

## Why this note exists

We want members of the Beacon2 team to be able to make simple edits to our
u3a website (a WordPress site using the **SiteWorks** theme) without needing
developer help. Different users should be able to make different kinds of
change — for example, committee members updating a welcome message, a news
editor posting items, a site manager adjusting pages.

Before committing to a solution, this note sets out what is realistically
possible, what each option would cost, and what we would get in return.

---

## What we already have

- **The website** runs WordPress with the u3a SiteWorks theme. SiteWorks
  itself is deliberately minimal; almost all editing uses WordPress's
  standard **block editor**. WordPress already supports several user roles
  (Administrator, Editor, Author, Contributor) with different permissions.
- **Beacon2** has its own login system and a detailed permissions scheme
  (73 "privilege resources", each with per-action grants). It has no
  connection to WordPress today — no single sign-on, no shared user list.
- A naming caveat: the word "SiteWorks" already appears inside Beacon2
  referring to a **scheduling platform** — unrelated to the WordPress theme.
  Any new feature in Beacon2 will need a distinct name (e.g. "Website
  editing") to avoid confusion.

---

## The two decisions to make

Every realistic solution is a combination of two independent choices.

### Decision 1 — How does a Beacon2 user get into the website editor?

Effort figures below are given two ways:

- **Developer-weeks by hand** — one experienced developer, full-time,
  no AI assistance. This is the classic costing basis.
- **Calendar time with Claude Code in the loop** — compressed
  developer time with an active human driver; typically a third to a
  half of the by-hand figure. Coding is much faster but design
  decisions, browser testing and review still bottleneck on the human,
  and Claude waits on the driver for most decisions. It is *not*
  "Claude running 24/7".

Neither figure includes your driving time, a test environment, or
post-launch support and onboarding. See
`docs/website-post-types-from-beacon2.md` for a worked example of the
two-figure estimating basis.

| Option | What it feels like for the user | By hand | With Claude Code | What it gives up |
|---|---|---|---|---|
| **A. Link out to WordPress** | Click "Edit website" in Beacon2, arrive at the WordPress login page, sign in again. | Less than a day. | A few hours. | Two passwords. WordPress roles are managed inside WordPress, not Beacon2. |
| **B. Beacon2 creates WordPress accounts automatically** | User still logs into WordPress separately, but their account is created and kept up to date by Beacon2 when their Beacon2 role changes. | Roughly one week. | 2–3 days. | Still two passwords, but we no longer have to remember to update WordPress when someone joins or leaves. |
| **C. Single sign-on** | User clicks "Edit website" and is logged straight into WordPress with their Beacon2 identity. | Two to three weeks (small custom WordPress plugin plus work in Beacon2). | 1–1½ weeks. | Ongoing responsibility to maintain that plugin across WordPress upgrades. |
| **D. Editor built inside Beacon2** | The user never leaves Beacon2; a small editor inside Beacon2 lets them change specific website content. | Four to eight weeks, depending on scope. | 2–4 weeks. See `docs/website-post-types-from-beacon2.md` for the specific case of the four SiteWorks structured post-types (`u3a_group`, `u3a_event`, `u3a_venue`, `u3a_contact`). | We are reinventing part of WordPress. Only simple edits are practical; complex layouts will still need WordPress. |

### Decision 2 — What should users be allowed to change?

| Tier | Examples | Risk of breaking the site |
|---|---|---|
| **1. Text only** | Update the chair's welcome message; change an opening-hours paragraph. | Very low — users cannot change layout, menus, or images. |
| **2. News and events** | Create and publish news posts or event notices. | Low — posts appear in pre-designed layouts. |
| **3. Page content** | Full control of the body of a page (text, images, blocks), but not templates or menus. | Moderate — a user could make a page look messy, but cannot break site-wide design. |
| **4. Full site editing** | Edit templates, headers, footers, global styles. | High — a mistake affects every page. |
| **5. Administrator** | Install plugins and themes, manage users. | Very high — capable of taking the site offline. |

Tiers 1 to 3 are what "simple edits" usually means. Tiers 4 and 5 already
exist in WordPress and do not need Beacon2 involvement — they should stay
with whoever currently administers the website.

---

## Recommended shape

**Start with option A (link out) offering tiers 2 and 3 (news/events and
page content) via WordPress's built-in Editor and Author roles.** This:

- Delivers real value in a few days of work.
- Requires no custom WordPress plugin.
- Is completely reversible — if we later decide we want SSO or an embedded
  editor, nothing done in this phase has to be undone.
- Produces evidence: we will learn which users actually use the feature,
  which kinds of edit they really want, and whether two passwords is a
  problem worth solving. That evidence should drive the decision on
  whether to invest in option B, C, or D.

If, after six months of use, the main complaint is "two passwords are
annoying", move to option B. If it is "I do not want to learn WordPress",
move to option D for a narrowly scoped editor. If it is "we keep forgetting
to remove access", B solves that too.

---

## What would change in Beacon2 under the recommendation

- A new permission named **Website editing** that controls whether a user
  sees the "Edit website" link in Beacon2. This fits into the existing
  Beacon2 permissions scheme and can be granted to any role.
- A new setting for the **website URL**, configured per u3a (alongside
  existing feature configuration).
- A new menu item, visible only to users with the permission, that opens
  the website's WordPress login in a new tab.
- A short note in the Beacon2 user guide explaining that WordPress role
  assignment happens inside WordPress itself.

No change is needed on the WordPress side beyond assigning the relevant
people to the Editor or Author role.

---

## Open questions management needs to decide

1. **One website per u3a, or a shared one?** Affects how the website URL
   is configured.
2. **Who should own WordPress role assignment?** Keep it with the current
   website administrator (option A), or move that responsibility to
   Beacon2 (options B or C)?
3. **Is single sign-on a must-have, or is one extra password acceptable?**
   The honest answer shapes whether we stop at option A or invest further.
4. **How technical are the people who will actually edit the site?** If
   the realistic answer is "not at all", a narrowly scoped embedded
   editor (option D, tier 1) may eventually be worth the larger
   investment — but only after we have learned from option A.

---

## Summary

Enabling website editing is a well-trodden path in WordPress. The question
is not whether we can do it, but how tightly we want to integrate it with
Beacon2 and how much we are willing to invest up front. The recommendation
is a small, quick first step (option A, tiers 2 and 3) that preserves
every future choice while delivering immediate value, followed by a review
in six months to decide whether heavier integration is justified by what
we have learned.
