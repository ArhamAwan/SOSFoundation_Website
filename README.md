# SOS Foundation website

The public website and its admin panel in one Next.js project.

## What works now (stage 1)

- **Sign-in**: email and password, hashed passwords, sign-out, automatic sign-out after 30 minutes without activity,
  lock-out after five wrong passwords, two roles (Admin and Editor).
- **Users and roles** (`/admin/users`): add people, change role, set a new password, turn an account off.
- **News and Events** and **Success Stories**: add, edit, publish, unpublish and delete. The public pages
  `/news-and-events` and `/our-impact/success-stories` (and each post and story page) are built from the database.
- **Media library**: upload photos (resized and converted to WebP in the browser), alt text, credit, consent, focal point.
- **Dashboard**: live counts and a "needs attention" list worked out from the content.
- **Preview / Live switch**: in Preview everything published is shown. In Live, posts and stories that do not meet the
  brief's rules (date, meta description, consent, alt text) and photos of people without recorded consent are hidden.

## Not connected yet

Pages, Programmes, Blog, Reports, Gallery, Partners, Leadership, Form submissions and Site settings open as design
previews with a yellow notice: they show the approved design but do not save. The other public pages (Home, About,
Programmes and so on) are served exactly as designed and are not editable yet. Two-factor sign-in and password-reset
emails are also still to come.

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

## Moving to other hosting later

The site needs Node.js and a Postgres database, nothing specific to Vercel. Point `DATABASE_URL` at the new database
and run `npm run build` then `npm start`. Uploaded photos live in the database, so they move with it.
