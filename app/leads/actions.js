'use server';
// What the Leads portal can change. Each action checks who is signed in first.
import { redirect } from 'next/navigation';
import { checkLogin, createSession, requireLeadsUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { hashPassword, verifyPassword, MIN_PASSWORD } from '@/lib/password';

const text = (form, name) => String(form.get(name) ?? '').trim();
const go = (path, kind, message) => redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(message)}`);
const STATUS_IN = { new: 'new', progress: 'in progress', closed: 'closed' };

export async function leadsLogin(form) {
  const email = text(form, 'email');
  const result = await checkLogin(email, form.get('password'));
  if (result.error) redirect(`/leads/login?error=${encodeURIComponent(result.error)}&email=${encodeURIComponent(email)}`);
  await createSession(result.user.id, form.get('remember') === 'on');
  redirect('/leads');
}

export async function saveLead(form) {
  await requireLeadsUser();
  const id = Number(form.get('id')) || 0;
  const status = STATUS_IN[text(form, 'status')] || 'new';
  await q('UPDATE submissions SET status = $1, note = $2 WHERE id = $3', [status, text(form, 'note').slice(0, 5000), id]);
  const back = String(form.get('back') || '').replace(/[^\w=&%.+\-]/g, '');
  go(`/leads?${back ? back + '&' : ''}id=${id}`, 'ok', 'Saved.');
}

export async function changePassword(form) {
  const me = await requireLeadsUser();
  const current = String(form.get('current') ?? '');
  const password = String(form.get('password') ?? '');
  const [row] = await q('SELECT password_hash FROM users WHERE id = $1', [me.id]);
  if (!(await verifyPassword(current, row.password_hash))) go('/leads/account', 'error', 'Your current password is not right.');
  if (password.length < MIN_PASSWORD) go('/leads/account', 'error', `The new password needs at least ${MIN_PASSWORD} characters.`);
  if (password !== String(form.get('confirm') ?? '')) go('/leads/account', 'error', 'The two new passwords do not match.');
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(password), me.id]);
  go('/leads/account', 'ok', 'Password changed.');
}
