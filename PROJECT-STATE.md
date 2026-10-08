# L.A.B by Timberlab — project state

Living handover note. Read this first in any new session.
Branch: `claude/upbeat-dirac-0sz2br`. Everything lives under `lab-timberlab/`
and `lab-timberlab-wp/`. **Ignore the repo root** (`index.html`, `Charlie/`,
`brand_assests/`) — that is an unrelated older "Deepwater" project, and the root
`CLAUDE.md` describes that project, not this one.

---

## The client and the brief

**L.A.B by Timberlab Pte Ltd** — a Singapore interior design and design-and-build
firm doing custom residential renovations. Audience: HDB, BTO, condominium and
landed homeowners wanting an end-to-end transformation.

Goals: generate leads · inform · showcase projects. Pillars: branding,
project showcasing, credibility.

Their two references, and the principle taken from each (they explicitly did not
want either copied):
- *The Local INN.terior* → clarity. A homeowner must quickly understand who the
  studio is, what it does and what happens if they engage it.
- *Ofthebox* → photography is the product. Give projects room.

## The design direction (approved — do not drift)

- **Typeface:** Archivo Variable, one family. Display is set wide
  (`wdth` 112, weight 500, tracking −0.035em); body at normal width.
  DM Mono for labels, numbers and captions. **No serif** — the client rejected
  an earlier Instrument Serif direction as "too curve".
- **Palette:** light. Paper `#F3F3F1`, elevated `#EAEAE7`, ink `#0F0F0F`,
  muted `#737378`, signal blue `#4A63C8` (softened from `#2743D9` at client
  request). **A dark/graphite palette was built and then rejected** — it is in
  the history (commit `abd67f4`, reverted by `48bbeab`) if ever revisited.
- **Emphasis:** headings split into a main part and a greyed second half
  ("Homes we have drawn" + *"and built."*). Never italic.
- **Hero:** full-bleed video/photo, headline over it, one positioning line
  ("A design-and-build studio for Singapore homes."), a "Scroll" cue, and the
  persistent header CTA. No duplicate in-hero button.
- **Three.js — "From plan to place":** a floor plan draws itself, walls rise,
  furniture appears, then a cut-away with the lights on. Choreographed for
  **exactly four** process steps. The plan geometry is code (`planScene.js`),
  not uploadable.
- **No custom cursor.** One was built and removed — the client reported lag and
  it added nothing.

## Confirmed client facts

- Address: 47 Jln Pemimpin, #04-05, Halcyon 2, Singapore 577200
- Phone: +65 8993 8778 · Email: sales@timberlab.sg
- Hours: Mon–Fri 9am–6pm · Sat 9am–12pm · Sun closed
- Live staging: https://slategrey-rail-602055.hostingersite.com (Hostinger).
  **Not reachable from the sandbox — the egress proxy blocks it.**

## Never invent

No testimonials, awards, accreditations, years in practice, project counts or
client names unless supplied. Unconfirmed values are hidden by `lab_known()`,
which filters anything matching "to be confirmed / to be supplied / tbc / —".

---

## What exists

### `lab-timberlab/` — the approved prototype (design reference)
Vite + HTML/CSS/JS, GSAP, Lenis, Three.js. Six pages. This is the **visual
source of truth**; the WordPress theme is compared against it.
`npm run dev` → http://localhost:5173

### `lab-timberlab-wp/` — the production WordPress theme
Custom theme, **deliberately dependency-free** — native meta boxes, no ACF Pro
or any paid plugin. PHP renders all copy (SEO); JS is motion only.

```
functions.php          bootstrap
inc/setup.php          supports, menus, the fixed image sizes the layouts crop to
inc/assets.php         enqueues the Vite build via assets/.vite/manifest.json
inc/post-types.php     project (+ lab_property_type taxonomy), service, step,
                       principle, person; term fields: sub-label, "is a home"
inc/fields.php         field toolkit: text, textarea, select, media, gallery
                       (per-image crop shape), sortable repeaters
inc/meta-boxes.php     editing screens, incl. page display-heading fields
inc/options.php        "L.A.B settings" — every heading, hero, figures, contact
inc/nav.php            navigation + fallback
inc/template-tags.php  rendering helpers (lab_known, lab_heading, cards…)
inc/enquiry.php        form handling: stored as a CPT *and* emailed, honeypot
inc/seed.php           one-click importer — idempotent, also repairs old installs
front-page.php · archive-lab_project.php · single-lab_project.php
taxonomy-lab_property_type.php · page-{services,studio,contact}.php
parts/{enquiry-form,process}.php
src/ (CSS + JS source) · assets/ (built, gitignored) · seed/ (demo content)
```

**Template naming matters:** WordPress looks for `archive-lab_project.php`, not
`archive-project.php`. Getting this wrong silently falls back to `index.php`.

### Content model the client edits
Projects (incl. gallery with per-image crop shape, before/after, "show on
homepage"), Services, Process steps, Principles (flagged homepage *or* Studio),
Team, Pages (body + display heading), and the L.A.B settings page.
Locked to the developer: typography, colour, spacing, grid, all motion, the 3D
scene, image crop ratios, templates.

---

## Project content

Nine real projects from the client's photography, processed by
`lab-timberlab/tools/process-photos.py` (HEIC→JPEG, oriented, resized, EXIF
stripped; 496 MB of originals → ~17 MB web). Originals are **not** in the repo.

| # | Title | Type |
|---|---|---|
| 01 | The Fluted Wall | HDB, Tampines GreenVerge |
| 02 | The Country Kitchen | HDB, Sembawang |
| 03 | The Garden Room | Condominium, Varsity Park |
| 04 | Stone and Brass | HDB, Tampines GreenVerge |
| 05 | Tanglin Regency | Condominium |
| 06 | Limewash and Walnut | HDB, Tampines GreenGlen |
| 07 | Soft Curves | HDB, Sengkang |
| 08 | Tengah Drive | HDB, Tengah |
| 09 | Koun Patisserie | Commercial |

Titles, descriptions and "design direction" labels are **our draft copy written
from the photographs** — still awaiting client confirmation, as are flat types
and completion years.

## Outstanding / awaiting the client

- The L.A.B **logo** (a typographic wordmark stands in).
- **Studio figures are SAMPLE values** (12+ / 260+ / 18) seeded purely so the
  count-up animation can be reviewed, labelled "Sample figures — to be confirmed".
  These must be replaced or removed before launch.
- Team entries are placeholders reading "Name"; replace or delete before launch.
- Is WhatsApp active on 8993 8778? Social links?
- Hero video is a **stock Pexels clip**, trimmed to 8.5s (after ~9s another
  company's signage appears). Wants replacing with L.A.B footage.
- Several project photos show a TV playing Netflix — worth asking for versions
  with the screens off.

---

## Working practices that matter

- **Verify in a real WordPress**, don't ship unverified PHP. A test rig is built
  by cloning `WordPress/WordPress` (6.7-branch) and
  `WordPress/sqlite-database-integration` **tag v2.1.13** (main has been
  restructured and has no `db.copy`) from GitHub — wordpress.org is proxy-blocked.
  Serve with `php -S` plus a router that tolerates the symlinked theme.
  Live testing is what caught the template-naming bug, missing permalinks, and a
  `data-count` attribute collision.
- **Compare structurally**, not by eyeballing tall screenshots: enumerate
  sections and headings on both prototype and WordPress and diff them.
- Headless Chromium has **no H.264**, so MP4-only video appears not to play.
  Always ship WebM *and* MP4.
- `npm run build` is mandatory before packaging — `assets/` is gitignored.
- Package for the client as a zip (full ~23 MB with demo content; lean ~755 KB
  without, for hosts with small upload limits) and send it directly.
- Git commit messages: use `git commit -F <file>`; inline `-m` with quotes and
  em-dashes has broken the shell.

## Client feedback already addressed

Round 1: softened hero video; removed the laggy cursor; stripped the hero back;
retidied the project sequence (numbers were overlapping the photos); softened the
blue; rolling numbers moved to Studio; "Every kind of Singapore home" became a
"View our works" link; removed the duplicate hero CTA.
Round 2 (live site): header nav rendered dark over the hero (the admin bar
offsets the page and broke the dark-section detection); Process missing from the
menu; page headings; the Studio "Four things we hold to" section; Commercial
wrongly listed as a kind of home; the Studio photograph.

---

## The Projects tab (done — commit `468a501`)

The client asked for `eightytwo.asia/portfolio` and `.../parkview-square`.
**Both are proxy-blocked from the sandbox**; the work was driven from
screenshots the user supplied, which are described in full in the commit
message and in the plan.

What was decided and built:
- **Index:** a uniform grid of square tiles — 3 across on desktop, 2 at tablet,
  1 on a phone — with nothing under each tile but the project name, centred,
  grey (`--stone`, 17px), darkening to ink on hover. Measured against the
  reference: 29.8px column gap, 72px row gap. Numbers and the type/location/
  direction tags are gone from the cards.
- **The filter bar stays.** The reference has none, but a homeowner needs to
  reach their own kind of flat — that is the page's job for lead generation.
- **The homepage did not change.** Its asymmetric numbered sequence was already
  approved; the contrast between the two is deliberate.
- **Project page:** a full-bleed darkened photograph to open, then summary and
  facts, then the story told in short centred paragraphs set between the
  photographs. Wide shots full width, upright shots paired. Figure captions and
  their counters are gone (alt text stays).

Still as before, deliberately: the "Materials and making" band on the project
page keeps its `--paper-2` background and signal-blue numbers. It is the
loudest thing left that the reference does not have — quietening it is a
one-line change if the client wants it.

### Fixed in passing
- The footer listed **Commercial** under "Homes". It now lists only property
  types flagged "kind of home" — the thing the client raised in Round 2, fixed
  on the filter at the time but missed in the footer.
- `lab_project_card()` emitted `data-parallax="0"`, and `.frame[data-parallax]
  > img` sets `height: 120%` on **presence** of the attribute, so a square tile
  would have had a 120%-tall offset image and no hover zoom. The attribute is
  now omitted at zero.
- The prototype's dark-section detection still used the viewport-sliver
  `IntersectionObserver` that broke the live header; it now measures against
  the header's own box like the theme does.

## Verifying this work again

A real WordPress rig is the only way to catch template-resolution and
permalink bugs. Rebuild it with:

```
git clone --depth 1 --branch 6.7 https://github.com/WordPress/WordPress.git
git clone --depth 1 --branch v2.1.13 \
  https://github.com/WordPress/sqlite-database-integration.git
```

Copy `db.copy` to `wp-content/db.php` and substitute the two placeholders
**without adding quotes** — they are already quoted in the file. Symlink the
theme, `php -S` with a router that falls through to `index.php`, install, then
`lab_run_seed()` from a CLI script with `wp_set_current_user(1)`.

Note: **the homepage cannot be regression-tested by comparing screenshots** —
the hero video and the Three.js canvas make it non-deterministic. Compare the
page height and prove instead that no changed selector appears on it.

## Outstanding — next tasks

1. Repackage and resend the theme zip (full and lean) so the client uploads once.
2. Still awaiting from the client: the logo, real studio figures (the current
   ones are flagged samples), team details, WhatsApp confirmation, social
   links, L.A.B hero footage, and confirmation of project names, flat types
   and completion years.
