'use server';
// Everything the admin panel can change goes through these functions. Each one checks who is signed in first.
import { redirect } from 'next/navigation';
import { checkLogin, countUsers, createSession, requireAdmin, requireUser } from '@/lib/auth';
import { q, setSetting } from '@/lib/db';
import { hashPassword, verifyPassword, MIN_PASSWORD } from '@/lib/password';
import { TYPES, getItem, isPreview, issuesOf, mediaMap, uniqueSlug, youtubeId } from '@/lib/content';
import { COLLECTIONS, hereOf } from '@/lib/collections';
import { deleteFile } from '@/lib/files';
import { SITE, pageEdits, pageFields, savePageEdits } from '@/lib/overrides';

const text = (form, name) => String(form.get(name) ?? '').trim();
const go = (path, kind, message) => redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(message)}`);
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ---------------------------------------------------------------- sign-in
export async function login(form) {
  const email = text(form, 'email');
  const result = await checkLogin(email, form.get('password'));
  if (result.error) redirect(`/admin/login?error=${encodeURIComponent(result.error)}&email=${encodeURIComponent(email)}`);
  await createSession(result.user.id, form.get('remember') === 'on');
  redirect(result.user.role === 'leads' ? '/leads' : '/admin');
}

/** First run only: creates the first admin account. Closed for good once any user exists. */
export async function setup(form) {
  if ((await countUsers()) > 0) redirect('/admin/login');
  const name = text(form, 'name');
  const email = text(form, 'email').toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!name || !validEmail(email)) go('/admin/setup', 'error', 'Enter your name and a valid email address.');
  if (password.length < MIN_PASSWORD) go('/admin/setup', 'error', `Use a password of at least ${MIN_PASSWORD} characters.`);
  if (password !== String(form.get('confirm') ?? '')) go('/admin/setup', 'error', 'The two passwords do not match.');
  const [user] = await q(`INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id`, [name, email, await hashPassword(password)]);
  await createSession(user.id, false);
  go('/admin', 'ok', 'Your admin account is ready.');
}

// ---------------------------------------------------------------- news posts and success stories
export async function saveItem(form) {
  const user = await requireUser();
  const type = text(form, 'type');
  const def = TYPES[type];
  if (!def) redirect('/admin');
  const id = Number(form.get('id')) || 0;
  const existing = id ? await getItem(type, id) : null;
  const here = `${def.admin}/${existing ? existing.id : 'new'}`;
  const title = text(form, 'title');
  if (!title) go(here, 'error', 'Add a title before saving.');

  const image = Number(form.get('image')) || null;
  const data =
    type === 'news'
      ? { date: /^\d{4}-\d{2}-\d{2}$/.test(text(form, 'date')) ? text(form, 'date') : null, location: text(form, 'location'), category: text(form, 'category'),
          programme: text(form, 'programme'), partners: text(form, 'partners'), body: text(form, 'body'), image, caption: text(form, 'caption'),
          gallery: form.getAll('gallery').map(Number).filter(Boolean), meta_description: text(form, 'meta_description'), home: [1, 2, 3].includes(Number(form.get('home'))) ? Number(form.get('home')) : 0 }
      : type === 'blog'
      ? { date: /^\d{4}-\d{2}-\d{2}$/.test(text(form, 'date')) ? text(form, 'date') : null, author: text(form, 'author'), role: text(form, 'role'),
          category: text(form, 'category'), programme: text(form, 'programme'), body: text(form, 'body'), excerpt: text(form, 'excerpt').slice(0, 400),
          link: /^\/[a-z0-9\-/]*$/.test(text(form, 'link')) ? text(form, 'link') : '', image, meta_description: text(form, 'meta_description') }
      : { programme: text(form, 'programme'), focus: text(form, 'focus'), location: text(form, 'location'), partners: text(form, 'partners'), body: text(form, 'body'),
          image, layout: text(form, 'layout') === 'landscape' ? 'landscape' : 'portrait', featured: form.get('featured') === 'on', consent_confirmed: form.get('consent_confirmed') === 'on' };

  const slug = await uniqueSlug(type, text(form, 'slug') || title, id);
  const intent = text(form, 'intent');
  let status = existing ? existing.status : 'draft';
  let blocked = [];
  if (intent === 'unpublish') status = 'draft';
  if (intent === 'publish') {
    const issues = issuesOf({ type, data }, await mediaMap());
    // Once the site is out of preview, nothing is published until it meets the rules.
    if (issues.length && !(await isPreview())) blocked = issues;
    else status = 'published';
  }

  let saved;
  if (existing) {
    await q(`UPDATE items SET slug = $1, title = $2, status = $3, data = $4::text::jsonb, updated_at = now(), updated_by = $5 WHERE id = $6`,
      [slug, title, status, JSON.stringify(data), user.id, existing.id]);
    saved = { id: existing.id };
  } else {
    const [{ next }] = await q('SELECT coalesce(max(sort), 0) + 1 AS next FROM items WHERE type = $1', [type]);
    [saved] = await q(`INSERT INTO items (type, slug, title, status, data, updated_by, sort) VALUES ($1, $2, $3, $4, $5::text::jsonb, $6, $7) RETURNING id`,
      [type, slug, title, status, JSON.stringify(data), user.id, Number(next) || 1]);
  }
  const there = `${def.admin}/${saved.id}`;
  // A Home page position belongs to one post: giving it to this post takes it from any other.
  if (type === 'news' && data.home) {
    await q(`UPDATE items SET data = jsonb_set(data, '{home}', '0'::jsonb) WHERE type = 'news' AND id <> $1 AND (data->>'home') = $2`, [saved.id, String(data.home)]);
  }
  if (blocked.length) go(there, 'error', 'Saved as a draft. It cannot be published yet: ' + blocked.join('; ') + '.');
  go(there, 'ok', intent === 'publish' ? 'Published.' : intent === 'unpublish' ? 'Unpublished. It is now a draft.' : 'Saved.');
}

export async function deleteItem(form) {
  await requireAdmin();
  const def = TYPES[text(form, 'type')];
  if (!def) redirect('/admin');
  await q('DELETE FROM items WHERE type = $1 AND id = $2', [text(form, 'type'), Number(form.get('id')) || 0]);
  go(def.admin, 'ok', `${def.label} deleted.`);
}

// ---------------------------------------------------------------- media library
export async function saveMedia(form) {
  await requireUser();
  const id = Number(form.get('id')) || 0;
  await q(`UPDATE media SET alt = $1, credit = $2, shows_people = $3, consent = $4, pos = $5 WHERE id = $6`,
    [text(form, 'alt'), text(form, 'credit'), form.get('shows_people') === 'on', form.get('consent') === 'on', text(form, 'pos') || 'center', id]);
  go(`/admin/media?id=${id}`, 'ok', 'Photo details saved.');
}

export async function deleteMedia(form) {
  await requireAdmin();
  const id = Number(form.get('id')) || 0;
  const used = await q(`SELECT title FROM items WHERE (data->>'image')::int = $1 OR (data->>'logo')::int = $1 OR data->'gallery' @> $2::text::jsonb LIMIT 3`, [id, JSON.stringify([id])]);
  if (used.length) go(`/admin/media?id=${id}`, 'error', 'This photo is used in: ' + used.map((u) => u.title).join('; ') + '. Remove it there first.');
  await q('DELETE FROM media WHERE id = $1', [id]);
  go('/admin/media', 'ok', 'Photo deleted.');
}

// ---------------------------------------------------------------- users
export async function createUser(form) {
  await requireAdmin();
  const name = text(form, 'name');
  const email = text(form, 'email').toLowerCase();
  const password = String(form.get('password') ?? '');
  const role = ['admin', 'editor', 'leads'].includes(text(form, 'role')) ? text(form, 'role') : 'editor';
  if (!name || !validEmail(email)) go('/admin/users', 'error', 'Enter a name and a valid email address.');
  if (password.length < MIN_PASSWORD) go('/admin/users', 'error', `The first password needs at least ${MIN_PASSWORD} characters.`);
  const taken = await q('SELECT id FROM users WHERE email = $1', [email]);
  if (taken.length) go('/admin/users', 'error', 'A user with that email already exists.');
  await q('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)', [name, email, await hashPassword(password), role]);
  go('/admin/users', 'ok', role === 'leads' ? `${name} can now sign in to the Leads portal at /leads. Share the password with them privately; they can change it there.` : `${name} can now sign in. Share the password with them privately; they can change it under their name at the top right.`);
}

export async function updateUser(form) {
  const me = await requireAdmin();
  const id = Number(form.get('id')) || 0;
  const here = `/admin/users?edit=${id}`;
  const name = text(form, 'name');
  const role = ['admin', 'editor', 'leads'].includes(text(form, 'role')) ? text(form, 'role') : 'editor';
  const active = form.get('active') === 'on';
  const password = String(form.get('password') ?? '');
  if (!name) go(here, 'error', 'Enter a name.');
  if (id === me.id && (!active || role !== 'admin')) go(here, 'error', 'You cannot remove your own admin access. Ask another admin to do it.');
  const [{ n: otherAdmins }] = await q(`SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND active AND id <> $1`, [id]);
  if (otherAdmins === 0 && (!active || role !== 'admin')) go(here, 'error', 'There must always be at least one active admin.');
  if (password && password.length < MIN_PASSWORD) go(here, 'error', `A new password needs at least ${MIN_PASSWORD} characters.`);
  await q('UPDATE users SET name = $1, role = $2, active = $3 WHERE id = $4', [name, role, active, id]);
  if (password) await q('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(password), id]);
  if (password || !active) await q('DELETE FROM sessions WHERE user_id = $1 AND user_id <> $2', [id, me.id]); // signs them out everywhere
  go('/admin/users', 'ok', 'User updated.');
}

export async function deleteUser(form) {
  const me = await requireAdmin();
  const id = Number(form.get('id')) || 0;
  if (id === me.id) go('/admin/users', 'error', 'You cannot delete your own account.');
  await q('DELETE FROM users WHERE id = $1', [id]);
  go('/admin/users', 'ok', 'User deleted.');
}

export async function updateAccount(form) {
  const me = await requireUser();
  const name = text(form, 'name');
  const current = String(form.get('current') ?? '');
  const password = String(form.get('password') ?? '');
  if (!name) go('/admin/account', 'error', 'Enter your name.');
  if (password) {
    const [row] = await q('SELECT password_hash FROM users WHERE id = $1', [me.id]);
    if (!(await verifyPassword(current, row.password_hash))) go('/admin/account', 'error', 'Your current password is not right.');
    if (password.length < MIN_PASSWORD) go('/admin/account', 'error', `The new password needs at least ${MIN_PASSWORD} characters.`);
    if (password !== String(form.get('confirm') ?? '')) go('/admin/account', 'error', 'The two new passwords do not match.');
    await q('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(password), me.id]);
  }
  await q('UPDATE users SET name = $1 WHERE id = $2', [name, me.id]);
  go('/admin/account', 'ok', password ? 'Name and password saved.' : 'Name saved.');
}

// ---------------------------------------------------------------- site mode
export async function setPreviewMode(form) {
  await requireAdmin();
  const preview = text(form, 'mode') === 'preview';
  await setSetting('preview_mode', preview);
  go('/admin', 'ok', preview ? 'Preview mode is on: published items show even when something is missing.' : 'Live mode is on: items with open issues are hidden from the website.');
}

// ---------------------------------------------------------------- form submissions
const STATUSES = ['new', 'in progress', 'closed'];

export async function updateSubmission(form) {
  await requireUser();
  const id = Number(form.get('id')) || 0;
  const given = text(form, 'status') === 'progress' ? 'in progress' : text(form, 'status'); // the status buttons send "progress"
  const status = STATUSES.includes(given) ? given : 'new';
  await q('UPDATE submissions SET status = $1, note = $2 WHERE id = $3', [status, text(form, 'note').slice(0, 5000), id]);
  const back = String(form.get('back') || '').replace(/[^\w=&%.+\-]/g, ''); // keeps the list's filters
  go(`/admin/submissions?${back ? back + '&' : ''}id=${id}`, 'ok', 'Saved.');
}

export async function deleteSubmission(form) {
  await requireAdmin();
  await q('DELETE FROM submissions WHERE id = $1', [Number(form.get('id')) || 0]);
  const back = String(form.get('back') || '').replace(/[^\w=&%.+\-]/g, '');
  go(`/admin/submissions${back ? '?' + back : ''}`, 'ok', 'Lead deleted.');
}


// ---- Fixed pages: text and photo edits (Pages, Programmes, Board and messages, Site settings) ----
const tidy = (v) => String(v ?? '').replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').trim();

export async function savePage(form) {
  await requireUser();
  const path = String(form.get('path') ?? '');
  const man = pageFields(path);
  const back = String(form.get('back') || '/admin/pages');
  const here = path === SITE ? '/admin/settings' : `/admin/pages/edit?p=${encodeURIComponent(path)}&from=${encodeURIComponent(back)}`;
  if (!man) go(back, 'error', 'That page cannot be edited.');
  const old = await pageEdits(path);
  const fields = {};
  for (const f of man.fields) {
    if (form.get('reset:' + f.k)) continue;   // back to the original
    const raw = form.get('f:' + f.k);
    if (f.kind === 'image') {
      const media = Number(raw) || 0;
      const alt = tidy(form.get('alt:' + f.k)).slice(0, 300);
      if (media) fields[f.k] = { media, alt };
      else if (alt && alt !== f.alt) fields[f.k] = { alt };   // the original photo with a better description
      continue;
    }
    if (raw === null) { if (old.fields?.[f.k]) fields[f.k] = old.fields[f.k]; continue; }
    const value = tidy(raw).slice(0, 5000);
    if (f.kind === 'url') {
      if (value && value !== f.md) {
        if (!/^https?:\/\//.test(value)) go(here, 'error', `${f.label}: the link must start with https://`);
        fields[f.k] = { url: value };
      }
    } else if (f.kind === 'phone' || f.kind === 'email') {
      if (value && value !== f.md) {
        if (f.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) go(here, 'error', 'Email: that does not look like an email address.');
        fields[f.k] = { text: value };
      }
    } else if (value !== f.md) {
      if (!value) go(here, 'error', `${f.label} in "${f.section}" is empty. Write something, or tick "Undo my change" to show the original.`);
      fields[f.k] = { md: value };
    }
  }
  const edits = { fields };
  if (path !== SITE) {
    const title = tidy(form.get('meta_title')).slice(0, 200);
    const description = tidy(form.get('meta_description')).slice(0, 400);
    if (title && title !== man.title) edits.title = title;
    if (description && description !== man.description) edits.description = description;
  }
  await savePageEdits(path, edits);
  go(here, 'ok', 'Saved. The page on the website is updated.');
}

// ---- Partners, reports and the gallery (one list-and-editor pattern; fields in lib/collections.js) ----
export async function saveEntry(form) {
  const user = await requireUser();
  const type = text(form, '_collection');
  const def = COLLECTIONS[type];
  if (!def) redirect('/admin');
  const id = Number(form.get('id')) || 0;
  const [existing] = id ? await q('SELECT * FROM items WHERE type = $1 AND id = $2', [type, id]) : [];
  const here = hereOf(type, `edit=${existing ? existing.id : 'new'}`);
  const title = text(form, 'title').slice(0, 300);
  if (!title) go(here, 'error', `Add a ${def.fields[0].label.toLowerCase()} before saving.`);
  const data = { ...(existing?.data || {}) };
  let sort = existing ? existing.sort : null;
  let live = existing ? existing.status === 'published' : true;
  const dropped = [];
  for (const f of def.fields) {
    const raw = form.get(f.name);
    const v = text(form, f.name);
    switch (f.kind) {
      case 'text': if (f.name !== 'title') data[f.name] = v.slice(0, 300); break;
      case 'textarea': data[f.name] = v.slice(0, 2000); break;
      case 'select': data[f.name] = f.options.includes(v) ? v : ''; break;
      case 'url':
        if (v && !/^https?:\/\/[^\s]+\.[^\s]+$/.test(v)) go(here, 'error', `${f.label}: write the full address, starting with https://`);
        data[f.name] = v; break;
      case 'youtube':
        if (v && !youtubeId(v)) go(here, 'error', 'That does not look like a YouTube link. Copy the address of the video from YouTube.');
        data[f.name] = v; break;
      case 'date': data[f.name] = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; break;
      case 'year':
        if (v && !(/^\d{4}$/.test(v) && Number(v) > 1990 && Number(v) < 2100)) go(here, 'error', 'Year: write it as four digits, for example 2026.');
        data[f.name] = v; break;
      case 'number': sort = Number.isFinite(Number(v)) && v !== '' ? Math.round(Number(v)) : sort; break;
      case 'check': data[f.name] = form.get(f.name) === 'on'; break;
      case 'status': live = form.get(f.name) === 'on'; break;
      case 'image': data[f.name] = Number(raw) || null; break;
      case 'images': data[f.name] = form.getAll(f.name).map(Number).filter(Boolean); break;
      case 'file': {
        const next = Number(raw) || null;
        if (data[f.name] && data[f.name] !== next) dropped.push(data[f.name]);   // replaced or removed: deleted once the save has worked
        data[f.name] = next; break;
      }
      default: break;
    }
  }
  const status = live ? 'published' : 'draft';
  const slug = await uniqueSlug(type, title, id);
  let savedId = existing?.id;
  if (existing) {
    await q(`UPDATE items SET slug = $1, title = $2, status = $3, data = $4::text::jsonb, sort = $5, updated_at = now(), updated_by = $6 WHERE id = $7`,
      [slug, title, status, JSON.stringify(data), sort ?? existing.sort, user.id, existing.id]);
  } else {
    // New partners go last; new albums, videos and clippings go first.
    const [{ lo, hi }] = await q('SELECT coalesce(min(sort), 0) AS lo, coalesce(max(sort), 0) AS hi FROM items WHERE type = $1', [type]);
    const pos = sort ?? (type === 'partner' || type === 'report' ? Number(hi) + 1 : Number(lo) - 1);
    [{ id: savedId }] = await q(`INSERT INTO items (type, slug, title, status, data, updated_by, sort) VALUES ($1, $2, $3, $4, $5::text::jsonb, $6, $7) RETURNING id`,
      [type, slug, title, status, JSON.stringify(data), user.id, pos]);
  }
  for (const fileId of dropped) await deleteFile(fileId);
  const issues = issuesOf({ type, data }, await mediaMap());
  const note = issues.length && live ? ` Not shown on the website until fixed: ${issues.join('; ')}.` : '';
  go(hereOf(type, `edit=${savedId}`), note ? 'error' : 'ok', (existing ? 'Saved.' : `${def.noun[0].toUpperCase() + def.noun.slice(1)} added.`) + (note || (live ? ' The website is updated.' : ' It is hidden from the website.')));
}

export async function deleteEntry(form) {
  await requireAdmin();
  const type = text(form, 'type');
  const def = COLLECTIONS[type];
  if (!def) redirect('/admin');
  const id = Number(form.get('id')) || 0;
  const [item] = await q('SELECT data FROM items WHERE type = $1 AND id = $2', [type, id]);
  if (item?.data?.file) await deleteFile(item.data.file);
  await q('DELETE FROM items WHERE type = $1 AND id = $2', [type, id]);
  go(hereOf(type), 'ok', `${def.noun[0].toUpperCase() + def.noun.slice(1)} deleted.`);
}
