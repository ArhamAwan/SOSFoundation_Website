// Sign-in sessions. A random token lives in an http-only cookie; only its hash is stored in the database.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { q } from './db';
import { verifyPassword } from './password';

const COOKIE = 'sosf_session';
const IDLE_MINUTES = 30; // sign out after 30 minutes without activity
const REMEMBER_DAYS = 30; // "Keep me signed in"
const MAX_FAILS = 5; // failed sign-ins per email within the window below
const FAIL_WINDOW_MINUTES = 15;

const sha = (s) => createHash('sha256').update(s).digest('hex');

export async function countUsers() {
  const [{ n }] = await q('SELECT count(*)::int AS n FROM users');
  return n;
}

/** Check an email and password. Returns { user } or { error }. */
export async function checkLogin(email, password) {
  email = String(email || '').trim().toLowerCase();
  const [{ n: fails }] = await q(`SELECT count(*)::int AS n FROM login_fails WHERE email = $1 AND at > now() - ($2::text || ' minutes')::interval`, [email, String(FAIL_WINDOW_MINUTES)]);
  if (fails >= MAX_FAILS) return { error: `Too many failed attempts. Try again in ${FAIL_WINDOW_MINUTES} minutes.` };
  const [user] = await q('SELECT * FROM users WHERE email = $1', [email]);
  const ok = user && user.active && (await verifyPassword(String(password || ''), user.password_hash));
  if (!ok) {
    await q('INSERT INTO login_fails (email) VALUES ($1)', [email]);
    return { error: 'The email or password is not right.' };
  }
  await q('DELETE FROM login_fails WHERE email = $1', [email]);
  return { user };
}

export async function createSession(userId, remember) {
  const token = randomBytes(32).toString('hex');
  await q('INSERT INTO sessions (token_hash, user_id, remember) VALUES ($1, $2, $3)', [sha(token), userId, !!remember]);
  await q('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
  await q(`DELETE FROM sessions WHERE (remember = FALSE AND last_seen_at < now() - interval '1 day') OR last_seen_at < now() - interval '${REMEMBER_DAYS} days'`);
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
    ...(remember ? { maxAge: REMEMBER_DAYS * 86400 } : {}) });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q('DELETE FROM sessions WHERE token_hash = $1', [sha(token)]);
  jar.delete(COOKIE);
}

/** The signed-in user, or null. Also returns null when the session has been idle too long. */
export const getUser = cache(async function getUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await q(
    `SELECT u.id, u.name, u.email, u.role, s.remember,
            extract(epoch FROM (now() - s.last_seen_at))::int AS idle
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND u.active`, [sha(token)]);
  if (!row) return null;
  const limit = row.remember ? REMEMBER_DAYS * 86400 : IDLE_MINUTES * 60;
  if (row.idle > limit) {
    await q('DELETE FROM sessions WHERE token_hash = $1', [sha(token)]);
    return null;
  }
  if (row.idle > 60) await q('UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1', [sha(token)]);
  return { id: row.id, name: row.name, email: row.email, role: row.role, isAdmin: row.role === 'admin' };
});

/** Use at the top of every admin page and action. Sends visitors who are not signed in to the sign-in screen. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/admin/login');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect('/admin?error=' + encodeURIComponent('Only admins can do that.'));
  return user;
}
