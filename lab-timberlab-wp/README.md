# L.A.B by Timberlab — WordPress theme

A custom theme built from the approved v0.1 concept. Content lives in the
WordPress admin; the design system, motion and the 3D process scene are owned by
the developer.

**No paid plugins.** Custom fields are native WordPress meta boxes, so there is
no ACF Pro licence to renew and nothing to migrate if a plugin is abandoned.

---

## Installing

1. Copy `lab-timberlab-wp/` into `wp-content/themes/` (rename to `lab-timberlab`).
2. Build the assets once — the theme ships without compiled files:
   ```bash
   npm install
   npm run build
   ```
3. Activate the theme in **Appearance → Themes**.
4. Go to **L.A.B settings → Import content** and press the button. This creates
   the nine projects with all their photography, the services, the four process
   steps, the principles, the pages, the navigation menu and the hero video, and
   switches permalinks to post name.
5. Once you are happy, the `seed/` folder (about 19 MB) can be deleted.

Requires WordPress 6.4+ and PHP 8.0+.

### Working on the design

```bash
npm run watch     # rebuild on save
```
For hot reloading, add `define( 'LAB_DEV_SERVER', 'http://localhost:5173' );` to
`wp-config.php` and run `npm run dev`. Remove the constant before deploying.

---

## What the client edits

| In the admin | Controls |
| --- | --- |
| **Projects** | Title, property type, home type, location, design direction, year, summary, brief, response, materials, cover photo, gallery, before/after, and whether it appears on the homepage |
| **Services** | Name, description, bullet list, photograph |
| **Process steps** | The four steps beside the 3D scene |
| **Principles** | The "Why L.A.B" list |
| **Team** | Name, role, portrait |
| **Pages** | Studio page body text, page titles and intro text |
| **L.A.B settings** | Every homepage heading, the hero headline and line, the hero video, studio figures, contact details, opening hours, social links, footer wording |
| **Appearance → Menus** | Navigation |
| **Enquiries** | Submissions received through the form |

Headings are split into a main part and a greyed part (for example "Homes we
have drawn" + "and built."), so the two-tone styling survives editing.

## What stays with the developer

Typography, colour, spacing and the grid; all scroll animation; the entire
"From plan to place" 3D scene; image crop ratios; responsive rules; page
templates.

Two constraints worth knowing:

- **The 3D floor plan is drawn in code** (`src/modules/planScene.js`). It cannot
  be replaced with a real floor plan from the admin.
- **The scene is choreographed for exactly four process steps.** A fifth will
  show its text but drift out of sync with the animation. The admin warns if the
  count changes.

---

## Structure

```
functions.php              bootstrap
inc/setup.php              theme supports, menus, image sizes
inc/assets.php             enqueues the Vite build (reads assets/.vite/manifest.json)
inc/post-types.php         projects, services, steps, principles, team + property-type taxonomy
inc/fields.php             the native field toolkit (text, media, gallery, repeaters)
inc/meta-boxes.php         editing screens
inc/options.php            the L.A.B settings page
inc/nav.php                navigation
inc/template-tags.php      rendering helpers
inc/enquiry.php            form handling, storage and notification
inc/seed.php               one-click starter content import

front-page.php             homepage
archive-lab_project.php    projects index (also serves property-type archives)
single-lab_project.php     project detail
taxonomy-lab_property_type.php
page-services.php / page-studio.php / page-contact.php   (assignable templates)
parts/                     enquiry form, process section

src/                       CSS and JS source
assets/                    build output (generated)
seed/                      starter content and photography (deletable after import)
```

## Email delivery

An enquiry is saved as a private `lab_enquiry` post **before** any email is
attempted, so a delivery failure never loses a lead. The email is a second,
independent path.

Two things that silently lose enquiries are handled in `inc/mail.php`:

- **The sender.** WordPress sends as `wordpress@<site-domain>` unless told
  otherwise. Mail from a shared host, claiming a domain that has not authorised
  that server, is routinely filed as spam. The sender is now set explicitly, and
  can be routed through real SMTP credentials. If no address is configured the
  theme derives `no-reply@<site-domain>` — but only when that is a valid address,
  so a site on `localhost` or a bare IP keeps WordPress's own default rather
  than handing PHPMailer something it will reject.
- **Silent failure.** `wp_mail()` returns false and core tells nobody. Failures
  are recorded, shown as a warning on every admin screen until the next send
  succeeds, and marked per enquiry in an **Emailed** column so the studio can
  see exactly which ones to chase.

**L.A.B settings → Email delivery** holds the sender and the SMTP details, with
a **Send a test email** button underneath. The password is never echoed back
into the page and is kept when the box is left blank.

**Credentials belong in `wp-config.php`, not the database.** Any of these wins
over the matching setting:

```php
define( 'LAB_SMTP_HOST',   'smtp.hostinger.com' );
define( 'LAB_SMTP_PORT',   587 );
define( 'LAB_SMTP_SECURE', 'tls' );          // tls | ssl | none
define( 'LAB_SMTP_USER',   'hello@example.sg' );
define( 'LAB_SMTP_PASS',   '…' );            // app password for Google Workspace
define( 'LAB_MAIL_FROM',   'no-reply@example.sg' );
define( 'LAB_MAIL_FROM_NAME', 'L.A.B website' );
```

Leave the SMTP server blank and the site keeps using the host's own mail, so an
unconfigured install behaves exactly as before.

## Notes

- **Images.** The layouts crop to fixed ratios and the theme registers matching
  sizes. Supply landscape photography for the wide slots and portrait for the
  tall ones; the gallery field lets each photo choose its shape.
- **Hero video.** Supply WebM and MP4 for each of desktop and mobile. WebM is
  offered first; MP4 covers Safari. Muted, looping, roughly 8–12 seconds.
- **Enquiries** are stored in the database *and* emailed to the address in
  settings, so nothing is lost if mail delivery fails. A honeypot field catches
  basic spam. For reliable delivery, add an SMTP plugin.
- **Accessibility and SEO.** All copy is server-rendered; JavaScript only adds
  motion. Reduced-motion visitors get no animation, no video and no 3D scene.
- **If WebGL is unavailable**, the process section falls back to a static plan.

## Still outstanding

- Real studio figures — the imported ones are clearly marked samples.
- Confirmation that WhatsApp is active on the studio number.
- Social media links.
- Project names, descriptions and design-direction labels were drafted from the
  photographs and need the client's confirmation, along with flat types and
  completion years.
