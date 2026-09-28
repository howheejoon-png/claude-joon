# L.A.B by Timberlab — Website Concept v0.1

First interactive frontend concept for **L.A.B by Timberlab Pte Ltd**, a Singapore interior design and design-and-build studio.
This is a *direction* prototype for client review, not the final WordPress build.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/
npm run preview
```

Pages: `index.html` (home) · `projects.html` (index + home-type filter) · `project.html?p=<slug>` (project template) · `services.html` · `studio.html` · `contact.html`

## The idea

**Positioning.** L.A.B is treated as a contemporary design-and-build practice, not a "timber" brand. The site's voice is calm, precise and specific: *"Your home, thought through."*

**Visual language: the working drawing.** Neutral gallery white (`#F3F3F1`), near-black (`#0F0F0F`) and one *blueprint blue* (`#2743D9`) used the way a pen is used on an architect's drawing: numbers, annotations, active states, the cursor. Nothing is beige-on-wood; photography carries the warmth.

**Typography.** Archivo (variable, one family) set wide for display (`wdth` 112, weight 500, tight tracking) and at normal width for body, with DM Mono for labels, numbers and captions. Emphasis is weight and tone, not italics. All open-source, self-hosted via npm (no paid dependencies, no CDN calls).

**Hero.** A full-bleed photograph of the first project fills the viewport; the studio statement is set over it in large type, with the project caption, the studio's one-line description and the primary call to action on a single baseline rule beneath.

**Homepage sequence.** Full-bleed project photography with the brand statement → one-sentence studio statement → editorial project sequence (large, asymmetric, numbered) → services list with sticky imagery → home types → **"From plan to place"** (the Three.js process section) → credibility (designed to be populated, nothing invented) → enquiry → footer.

**Three.js concept: "From plan to place".** A floor plan draws itself as the section scrolls in; walls rise during *Design*; furniture volumes appear and the camera drops toward eye level during *Build*; at *Handover* the walls are cut away to a model and the lights come on. It visualises what a design-and-build studio does: turning a drawing into a home. HTML holds all the information; WebGL is only atmosphere.

**Motion.** GSAP + ScrollTrigger for masked line reveals, clip reveals, parallax and the scrubbed 3D scene; Lenis for smooth scrolling; a small custom cursor on desktop. Everything respects `prefers-reduced-motion`.

**Mobile.** A deliberate layout, not a shrunk desktop: full-screen serif menu, stacked project sequence, the 3D scene reframed for portrait (camera pulled back, step text as a card at the bottom of the sticky frame), no cursor, no pointer parallax, lower device pixel ratio.

## Performance choices

- Three.js is code-split and only loaded when the process section approaches the viewport.
- Renders only while the section is on screen and only when scroll progress or pointer changed (no idle render loop).
- `devicePixelRatio` capped at 1.5 (1 on mobile); resources disposed on `pagehide`.
- If WebGL is unavailable, a static SVG plan is shown; the page never depends on it.
- Images lazy-load; remote photography that fails to load is swapped for a designed local placeholder (`public/img/ph/`).

## Structure (built to become WordPress)

```
index.html, projects.html, project.html, services.html, studio.html, contact.html   ← page templates
src/styles/tokens.css        ← design tokens (→ theme.json)
src/styles/base.css          ← reset, type, buttons, primitives
src/styles/components.css    ← header, menu, footer, cursor, form
src/styles/sections.css      ← homepage sections
src/styles/pages.css         ← inner-page layouts
src/data/site.js             ← site options: nav, CTA, contact (→ Theme Options)
src/data/projects.js         ← projects (→ CPT "project" with these fields)
src/data/services.js         ← services + home types (→ CPT "service" / repeater)
src/data/process.js          ← process steps (→ repeater; also drives the 3D scene text)
src/components/*.js          ← header, footer, enquiry form, cursor (→ template parts)
src/modules/planScene.js     ← Three.js experience (developer-owned)
src/modules/motion.js        ← GSAP reveal system (developer-owned)
src/pages/*.js               ← per-template rendering (→ PHP templates)
```

Content and presentation are separated: the client will edit copy, project fields, galleries, services, contact details and navigation; the developer owns the design system, motion and the 3D scene.

## Placeholder register (must be confirmed or supplied before launch)

- **Logo** — the client's existing logo is not in this repository; a typographic wordmark stands in.
- **Photography** — supplied by the client (nine projects), processed to web size by `tools/process-photos.py` into `public/img/projects/<slug>/`. Raw originals are kept out of the repository (`source-photos/` is ignored).
- **Projects** — nine real projects identified from the client's folder names. Titles, descriptions, "design direction" labels and material lists are DRAFT copy written from the photographs. Home type (3-room, 4-room, and so on), BTO or resale status, completion year and the Koun Patisserie location are unknown and marked "To be confirmed".
- **Before / after** — no "before" photography was supplied, so the module is hidden until it exists for a project.
- **Service names and descriptions** — proposed wording, flagged on the page.
- **Studio story, founding year, team** — placeholders only.
- **Testimonials, figures, accreditations, awards, media, partner logos** — empty designed slots; nothing has been invented.
- **Contact details** — address, phone, email and opening hours are CONFIRMED (47 Jln Pemimpin, #04-05, Halcyon 2, Singapore 577200 · +65 8993 8778 · Mon–Fri 9am–6pm, Sat 9am–12pm, Sun closed). Email is confirmed as sales@timberlab.sg. Still outstanding: whether WhatsApp is active on the studio number, and the social media links.
- **Enquiry form** — proposed fields; submission is a demo (nothing is sent).
- **Copy** — all headings and paragraphs are draft copy in the proposed voice.

## Tools

`node tools/screenshot.mjs <url> <label> [w] [h] [scrollTo|#selector+offset]` captures review screenshots into `shots/` (needs Chromium; used for the self-review of this concept).
