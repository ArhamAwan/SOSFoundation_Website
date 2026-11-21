'use server';
// Everything the admin panel can change goes through these functions. Each one checks who is signed in first.
import { redirect } from 'next/navigation';
import { checkLogin, countUsers, createSession, requireAdmin, requireUser } from '@/lib/auth';
import { q, setSetting } from '@/lib/db';
import { hashPassword, verifyPassword, MIN_PASSWORD } from '@/lib/password';
import { TYPES, getItem, isPreview, issuesOf, mediaMap, uniqueSlug } from '@/lib/content';

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
    [saved] = await q(`UPDATE items SET slug = $1, title = $2, status = $3, data = $4::text::jsonb, updated_at = now(), updated_by = $5 WHERE id = $6 RETURNING id`,
      [slug, title, status, JSON.stringify(data), user.id, existing.id]);
  } else {
    [saved] = await q(`INSERT INTO items (type, slug, title, status, data, updated_by, sort) VALUES ($1, $2, $3, $4, $5::text::jsonb, $6, (SELECT coalesce(max(sort), 0) + 1 FROM items WHERE type = $1)) RETURNING id`,
      [type, slug, title, status, JSON.stringify(data), user.id]);
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
  const used = await q(`SELECT title FROM items WHERE (data->>'image')::int = $1 OR data->'gallery' @> $2::text::jsonb LIMIT 3`, [id, JSON.stringify([id])]);
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
  const status = STATUSES.includes(text(form, 'status')) ? text(form, 'status') : 'new';
  await q('UPDATE submissions SET status = $1, note = $2 WHERE id = $3', [status, text(form, 'note').slice(0, 5000), id]);
  go(`/admin/submissions?id=${id}`, 'ok', 'Saved.');
}

export async function deleteSubmission(form) {
  await requireAdmin();
  await q('DELETE FROM submissions WHERE id = $1', [Number(form.get('id')) || 0]);
  go('/admin/submissions', 'ok', 'Lead deleted.');
}
