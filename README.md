# SOS Foundation website

The public website and its admin panel in one Next.js project.

## What works now (stage 1)

- **Sign-in**: email and password, hashed passwords, sign-out, automatic sign-out after 30 minutes without activity,
  lock-out after five wrong passwords, two roles (Admin and Editor).
- **Users and roles** (`/admin/users`): add people, change role, set a new password, turn an account off.
- **News and Events** and **Success Stories**: add, edit, publish, unpublish and delete. The public pages
  `/news-and-events` and `/our-impact/success-stories` (and each post and story page) are built from the database.
- **Media library**: upload photos (resized and converted to WebP in the browser), alt text, credit, consent, focal point.
- **Website forms** (Volunteer, Youth and Brand Ambassador, Partnership, Corporate CSR, Contact, Newsletter): each entry
  is saved as a lead under **Leads** (`/admin/submissions`), with search, status, private note, reply by email and CSV export.
- **Leads portal** (`/leads`, sign in at `/leads/login`): a separate page for the people who follow up enquiries, in the
  website's own look. Give someone the **Leads only** role under Admin → Users: they can sign in to `/leads` (read leads,
  set status, add notes, email / call / WhatsApp, export CSV, change their password) and are never let into `/admin`.
  Admins and editors can use the portal too. The admin's own Leads section stays.
- **Pages, Programmes, Board and messages** (`/admin/pages`, `/admin/programmes`, `/admin/leadership`): every fixed
  page's headings, paragraphs, list items and photos (with alt text), plus its search title and meta description. Text takes
  light formatting: `**bold**`, `*italic*`, `[link](https://…)` and new lines. "Undo my change" brings back the original.
  Edits are stored in the `settings` table as `page:<path>` and applied when the page is served (`lib/overrides.js`).
- **Site settings** (`/admin/settings`): the footer's intro text, address, phone, email and social links, on every page.
- **Blog** (`/admin/blog`): posts with author, date, category, programme, body, featured photo and meta description, at
  `/blog/<slug>`. A post can instead open another page (the three success stories on the Blog page do this).
- **Partners** (`/admin/partners`): name, category, website link, logo, MoU badge and order. They fill the Partnerships page
  and the two logo strips on the Home page ("SOS Group of Companies" is the second strip).
- **Reports and Publications** (`/admin/reports`): title, type, year, description, PDF and optional cover, offered for
  download on `/reports-and-publications`.
- **Gallery** (`/admin/gallery`): photo albums (cover and photos, each album has its own page at `/media-gallery/<slug>`),
  YouTube videos, campaign materials (PDF/JPG/PNG downloads) and press clippings grouped by event.
- **Documents** (report PDFs, campaign materials) are stored in the database in 3 MB parts (`files`, `file_parts`); the
  browser uploads them part by part to `/admin/files`, so the host's upload and packet limits are never reached (25 MB
  per file). They are served from `/files/<id>/<name>`.
- **Home page news**: give a news post a "Position on the Home page" (1 to 3; 1 is shown large).
- **Dashboard**: live counts and a "needs attention" list worked out from the content.
- **Preview / Live switch**: in Preview everything published is shown. In Live, posts and stories that do not meet the
  brief's rules (date, meta description, consent, alt text) and photos of people without recorded consent are hidden.

## Not connected yet

Every admin section now saves. Two-factor sign-in and password-reset emails are still to come.

### How page editing works
`tools/mark_editable.py` (run by the design export) marks each editable element in the exported pages with
`data-e="<key>"` and lists the fields in `lib/generated/fields.json`. A key comes from the element's original text (or
photo file), so if a design is re-exported with that text changed, an edit made to the old text no longer applies and the
new design text shows. Posts and success stories are not in this list; they are edited under News and Success Stories.

## Put it on Vercel (free plan)

1. Push this folder to GitHub. Vercel builds it as a Next.js project (`vercel.json` sets that).
2. In Vercel: project → **Storage** → **Create Database** → **Neon** (Postgres) → connect it to this project.
   That adds `DATABASE_URL` for you.
3. **Deployments** → latest deployment → **Redeploy**.
4. Open `/admin`. The first visit asks you to create the first admin account. That screen closes for good once a user exists.

The tables and the starting content (five news stories, seven success stories, the photo library) are created
automatically the first time the site connects to an empty database.

## Run it on your own computer

```bash
npm install
npm run dev
```

With no `DATABASE_URL`, it uses a local file database in `.data/` so it runs with no setup. To use a real Postgres
database, copy `.env.example` to `.env.local` and fill in `DATABASE_URL`.

## Where things are

| Path | What it is |
| --- | --- |
| `app/admin/` | The admin screens. `actions.js` holds every save, publish and user change. |
| `app/[[...path]]/route.js` | Serves every public page and the admin design previews. |
| `app/media/[id]/route.js` | Serves uploaded photos (stored in the database). |
| `lib/db.js` | Database connection, tables and starting content. |
| `lib/auth.js` | Sign-in sessions and roles. |
| `lib/content.js` | Publishing rules shared by the admin and the public pages. |
| `lib/public.js` | Fills the page templates with database content. |
| `lib/generated/` | Pages, templates and starting content exported from the approved designs. Do not edit by hand. |
| `public/assets/` | Images and the font. |

## Hosting

The site needs Node.js 20 or later and a database: Postgres (Vercel + Neon) or MySQL / MariaDB (cPanel hosting).
`DATABASE_URL` picks the database: `postgres://…` or `mysql://user:password@localhost/database`.
Uploaded photos live in the database, so they move with it.

### The live site on cPanel (sosfoundation.org.pk)

The live site runs on the client's cPanel hosting with cPanel's Application Manager (Phusion Passenger, Node.js 22)
and a MariaDB database (`sosfound_site`). The host has no terminal, so a self-contained build is uploaded:

1. Build: `STANDALONE=1 npm run build`, then copy `.next/static` to `.next/standalone/.next/static`,
   `public` to `.next/standalone/public`, and add `app.js` containing `require('./server.js');` (Passenger's start file).
2. Zip the contents of `.next/standalone` and upload it in cPanel File Manager, then extract it over `/home/sosfound/sosf-site`.
3. In Application Manager, restart the app (or edit and save it).

The app's `DATABASE_URL` and `SITE_URL` are set on the application in Application Manager, not in a file.
The domain's folder (`public_html`) still holds the old WordPress site, which the app replaces while it is registered.
Its `.htaccess` must start with `RewriteEngine Off`; otherwise WordPress's rewrite rules break every page except Home.

Only `sosfoundation.org.pk` is open to search engines. Every other address (the Vercel demo, staging) sends `noindex`.
