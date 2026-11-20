// Every form on the website posts here: the entry is saved as a lead in the admin panel, and the visitor sees the thank-you page.
import { createHash } from 'node:crypto';
import { q, DatabaseNotConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FORMS = new Set(['Volunteer Registration', 'Youth Registration', 'Brand Ambassador', 'Partnership', 'Corporate CSR', 'Contact', 'Newsletter']);
const go = (request, path) => new Response(null, { status: 303, headers: { location: path } }); // relative, so it stays on the address the visitor used

export async function POST(request) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return go(request, '/');
  }
  // The hidden "leave this empty" box is only ever filled in by spam robots: pretend all went well and keep nothing.
  if (String(form.get('_hp') || '').trim()) return go(request, '/thank-you');

  const name = String(form.get('_form') || '');
  const formName = FORMS.has(name) ? name : 'Website form';
  const data = [];
  for (const key of new Set(form.keys())) {
    if (key.startsWith('_') || data.length >= 40) continue;
    const value = form.getAll(key).filter((v) => typeof v === 'string').map((v) => v.trim()).filter(Boolean).join(', ');
    data.push([key.slice(0, 120), value.slice(0, 5000)]);
  }
  let page = '';
  try {
    const ref = new URL(request.headers.get('referer') || '');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
    if (ref.host === host) page = ref.pathname;
  } catch {}
  if (!data.some(([, v]) => v)) return go(request, page || '/');

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || '';
  const ipHash = ip ? createHash('sha256').update('sosf:' + ip).digest('hex').slice(0, 32) : '';
  try {
    // More than 10 entries from one address in 10 minutes is a robot: keep nothing more from it for now.
    if (ipHash) {
      const [{ n }] = await q(`SELECT count(*)::int AS n FROM submissions WHERE ip_hash = $1 AND created_at > now() - interval '10 minutes'`, [ipHash]);
      if (n >= 10) return go(request, '/thank-you');
    }
    await q(`INSERT INTO submissions (form, page, data, ip_hash) VALUES ($1, $2, $3::text::jsonb, $4)`, [formName, page, JSON.stringify(data), ipHash]);
  } catch (err) {
    if (!(err instanceof DatabaseNotConfigured)) console.error('Form submission failed', err);
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not sent</title><body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 80px auto; padding: 0 20px; line-height: 1.6; color: #373b73">' +
      '<h1>Your form was not sent</h1><p>Something went wrong on our side. Please go back and try again in a few minutes, or email us at <a href="mailto:hello@sosfoundation.org.pk">hello@sosfoundation.org.pk</a>.</p></body>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  return go(request, '/thank-you');
}
