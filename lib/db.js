// One small database layer for the whole site.
// - With DATABASE_URL set (Vercel + Neon, or any Postgres) it uses that database.
// - Without it, on your own computer, it uses a local file database in .data/ so the site runs with no setup.
import seed from './generated/seed.json';
import { hashPassword } from './password';

export class DatabaseNotConfigured extends Error {
  constructor() {
    super('No database is connected. Add a Postgres database and set DATABASE_URL.');
    this.name = 'DatabaseNotConfigured';
  }
}

// Website form entries. data is a list of [field, value] pairs so the fields keep the order of the form.
const SUBMISSIONS = `CREATE TABLE IF NOT EXISTS submissions (
     id SERIAL PRIMARY KEY, form TEXT NOT NULL, page TEXT NOT NULL DEFAULT '', data JSONB NOT NULL DEFAULT '[]'::jsonb,
     status TEXT NOT NULL DEFAULT 'new', note TEXT NOT NULL DEFAULT '', sheet TEXT NOT NULL DEFAULT '', ip_hash TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'editor', active BOOLEAN NOT NULL DEFAULT TRUE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login_at TIMESTAMPTZ)`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, remember BOOLEAN NOT NULL DEFAULT FALSE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS login_fails (email TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS media (
     id SERIAL PRIMARY KEY, url TEXT NOT NULL, filename TEXT NOT NULL DEFAULT '', alt TEXT NOT NULL DEFAULT '', credit TEXT NOT NULL DEFAULT '',
     shows_people BOOLEAN NOT NULL DEFAULT FALSE, consent BOOLEAN NOT NULL DEFAULT FALSE, pos TEXT NOT NULL DEFAULT 'center',
     width INTEGER, height INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), uploaded_by INTEGER)`,
  `CREATE TABLE IF NOT EXISTS media_files (media_id INTEGER PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE, content_type TEXT NOT NULL, bytes BYTEA NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS items (
     id SERIAL PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
     data JSONB NOT NULL DEFAULT '{}'::jsonb, sort INTEGER NOT NULL DEFAULT 0,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by INTEGER,
     UNIQUE (type, slug))`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL)`,
  SUBMISSIONS,
];

async function connect() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url && /^(mysql|mariadb):/.test(url)) {
    const { connectMysql } = await import('./mysql.js');
    return connectMysql(url.replace(/^mariadb:/, 'mysql:'));
  }
  if (url) {
    const { default: postgres } = await import('postgres');
    // Keep connections open between clicks so each page does not pay for a new connection.
    const sql = postgres(url, { max: 5, prepare: false, idle_timeout: 300, max_lifetime: 1800, connect_timeout: 15, onnotice: () => {} });
    return (text, params = []) => sql.unsafe(text, params);
  }
  if (process.env.VERCEL) throw new DatabaseNotConfigured();
  const { PGlite } = await import('@electric-sql/pglite');
  const { mkdirSync } = await import('node:fs');
  const dir = process.env.PGLITE_DIR || '.data/pg';
  mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  return async (text, params = []) => (await db.query(text, params)).rows;
}

async function init() {
  const query = await connect();
  // Fast path: one query tells us the tables and starting content are already in place.
  try {
    const done = await query(`SELECT key FROM settings WHERE key IN ('seeded', $1)`, [LATEST]);
    if (done.length === 2) return ensureAdmin(query);
    if (done.length === 1) {
      await runUpdates(query);
      return ensureAdmin(query);
    }
  } catch (err) {
    // The settings table does not exist yet: first run, carry on and create everything.
  }
  for (const stmt of SCHEMA) {
    try {
      await query(stmt);
    } catch (err) {
      // Two cold starts can race to create the same table; the second attempt finds it already there.
      await query(stmt);
    }
  }
  const first = await query(`INSERT INTO settings (key, value) VALUES ('seeded', 'true'::jsonb) ON CONFLICT (key) DO NOTHING RETURNING key`);
  if (first.length) {
    await seedContent(query);
    for (const [key] of UPDATES) await query(`INSERT INTO settings (key, value) VALUES ($1, 'true'::jsonb) ON CONFLICT (key) DO NOTHING`, [key]);
  } else {
    await runUpdates(query);
  }
  return ensureAdmin(query);
}

// Changes made after the site went live are applied once to an existing database, in order (fresh databases get them from the seed).
const UPDATES = [
  ['content_2026_11_19', update19],
  ['content_2026_11_20', update20],
  ['content_2026_11_21', update21],
];
const LATEST = UPDATES[UPDATES.length - 1][0];

async function runUpdates(query) {
  for (const [key, run] of UPDATES) {
    const claim = await query(`INSERT INTO settings (key, value) VALUES ($1, 'true'::jsonb) ON CONFLICT (key) DO NOTHING RETURNING key`, [key]);
    if (!claim.length) continue; // done already, or another request is doing it
    try {
      await run(query);
    } catch (err) {
      await query('DELETE FROM settings WHERE key = $1', [key]); // try again on the next request
      throw err;
    }
  }
}

// 19 Nov 2026: the BECS MoU news post and the photo for "A Daily Meal"
async function update19(query) {
  const mediaId = async (url) => {
    if (!url) return null;
    const [have] = await query('SELECT id FROM media WHERE url = $1', [url]);
    if (have) return have.id;
    const m = seed.media.find((x) => x.url === url);
    if (!m) return null;
    const [row] = await query(`INSERT INTO media (url, filename, alt, pos, width, height, shows_people) VALUES ($1, $2, $3, 'center', $4, $5, TRUE) RETURNING id`,
      [m.url, m.filename, m.alt, m.width, m.height]);
    return row.id;
  };
  for (const n of seed.news.filter((x) => x.added === 'content_2026_11_19')) {
    const [exists] = await query(`SELECT id FROM items WHERE type = 'news' AND slug = $1`, [n.slug]);
    if (exists) continue;
    const data = { date: n.date, location: n.location, category: n.category, programme: '', partners: '', body: n.body.join('\n\n'),
      image: await mediaId(n.image), caption: n.caption, gallery: [], meta_description: '', home: n.home || 0 };
    await query(`INSERT INTO items (type, slug, title, status, data, sort) VALUES ('news', $1, $2, 'published', $3::text::jsonb, $4)`, [n.slug, n.title, JSON.stringify(data), n.sort ?? -1]);
  }
  for (const s of seed.stories.filter((x) => x.added === 'content_2026_11_19' && x.photo)) {
    const id = await mediaId(s.photo.image);
    await query(`UPDATE items SET data = data || $2::text::jsonb WHERE type = 'story' AND slug = $1 AND (data->>'image') IS NULL`,
      [s.slug, JSON.stringify({ image: id, layout: s.photo.portrait ? 'portrait' : 'landscape' })]);
  }
}

// 20 Nov 2026: website forms are saved here, and the Home page shows the BECS, RWU and NCHD MoU signings
async function update20(query) {
  await query(SUBMISSIONS);
  const slugs = seed.news.filter((n) => n.home).map((n) => n.slug);
  await query(`UPDATE items SET data = data || '{"home": true}'::jsonb WHERE type = 'news' AND slug = ANY($1)`, [slugs]); // positions follow in update21
}

// Round 5: the client's order for the Home page news (RWU, NCHD and SOS MoU; RWU and SOS MoU; BECS MoU); no other post keeps a Home page place
async function update21(query) {
  await query(`UPDATE items SET data = jsonb_set(data, '{home}', '0'::jsonb) WHERE type = 'news' AND data ? 'home'`);
  for (const n of seed.news.filter((x) => x.home)) {
    await query(`UPDATE items SET data = jsonb_set(data, '{home}', $2::text::jsonb) WHERE type = 'news' AND slug = $1`, [n.slug, String(n.home)]);
  }
}

// Optional: create the first admin from environment variables instead of the setup screen.
async function ensureAdmin(query) {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const [{ n }] = await query('SELECT count(*)::int AS n FROM users');
    if (n === 0) {
      await query(`INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') ON CONFLICT (email) DO NOTHING`, [
        process.env.ADMIN_NAME || 'Admin', process.env.ADMIN_EMAIL.trim().toLowerCase(), await hashPassword(process.env.ADMIN_PASSWORD)]);
    }
  }
  return query;
}

// The content supplied by SOS Foundation (five news stories, seven success stories, the photo library).
async function seedContent(query) {
  await query(`INSERT INTO settings (key, value) VALUES ('preview_mode', 'true'::jsonb) ON CONFLICT (key) DO NOTHING`);
  const ids = {};
  const posOf = {};
  for (const n of seed.news) posOf[n.image] = n.pos;
  for (const s of seed.stories) if (s.photo) posOf[s.photo.image] = s.photo.pos;
  for (const m of seed.media) {
    // Seeded photos are treated as showing people until someone reviews them and records consent.
    const [row] = await query(
      `INSERT INTO media (url, filename, alt, pos, width, height, shows_people) VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id`,
      [m.url, m.filename, m.alt, posOf[m.url] || 'center', m.width, m.height]);
    ids[m.url] = row.id;
  }
  let sort = 0;
  for (const n of seed.news) {
    const data = { date: n.date, location: n.location, category: n.category, programme: '', partners: '', body: n.body.join('\n\n'),
      image: ids[n.image] || null, caption: n.caption, gallery: n.gallery.map((g) => ids[g.image]).filter(Boolean), meta_description: '', home: n.home || 0 };
    await query(`INSERT INTO items (type, slug, title, status, data, sort) VALUES ('news', $1, $2, 'published', $3::text::jsonb, $4)`, [n.slug, n.title, JSON.stringify(data), n.sort ?? sort++]);
  }
  sort = 0;
  for (const s of seed.stories) {
    const body = s.items.map(([kind, text]) => (kind === 'q' ? '> ' + text : text)).join('\n\n');
    const data = { programme: s.programme, focus: s.focus, location: s.location, partners: s.partners, body,
      image: s.photo ? ids[s.photo.image] : null, layout: s.photo && !s.photo.portrait ? 'landscape' : 'portrait', featured: false, consent_confirmed: false };
    await query(`INSERT INTO items (type, slug, title, status, data, sort) VALUES ('story', $1, $2, 'published', $3::text::jsonb, $4)`, [s.slug, s.title, JSON.stringify(data), sort++]);
  }
}

const g = globalThis;
export async function db() {
  if (!g.__sosfDb) {
    g.__sosfDb = init().catch((err) => {
      g.__sosfDb = null;
      throw err;
    });
  }
  return g.__sosfDb;
}

/** Run a query and get its rows. */
export async function q(text, params) {
  const query = await db();
  return query(text, params);
}

export async function getSetting(key, fallback = null) {
  const rows = await q('SELECT value FROM settings WHERE key = $1', [key]);
  return rows.length ? rows[0].value : fallback;
}

export async function setSetting(key, value) {
  await q(`INSERT INTO settings (key, value) VALUES ($1, $2::text::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, JSON.stringify(value)]);
}
