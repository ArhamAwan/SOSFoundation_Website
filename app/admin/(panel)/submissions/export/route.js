// Download leads as a CSV file that opens in Excel or Google Sheets (same form, status and search filters as the Leads list).
import { getUser } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

const cell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formulas running from form text
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export async function GET(request) {
  const user = await getUser();
  if (!user) return Response.redirect(new URL('/admin/login', request.url), 303);
  const sp = new URL(request.url).searchParams;
  const form = sp.get('form') || '';
  const status = ['new', 'in progress', 'closed'].includes(sp.get('status')) ? sp.get('status') : '';
  const search = String(sp.get('q') || '').trim().slice(0, 100);
  const where = [], args = [];
  if (form) { args.push(form); where.push(`form = $${args.length}`); }
  if (status) { args.push(status); where.push(`status = $${args.length}`); }
  if (search) { args.push('%' + search.toLowerCase() + '%'); where.push(`(lower(data::text) LIKE $${args.length} OR lower(note) LIKE $${args.length})`); }
  const rows = await q(`SELECT * FROM submissions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id`, args);
  const fields = [];
  for (const r of rows) for (const [k] of r.data) if (!fields.includes(k)) fields.push(k);
  const head = ['Received', 'Form', 'Page', 'Status', ...fields, 'Private note'];
  const lines = [head.map(cell).join(',')];
  for (const r of rows) {
    const d = Object.fromEntries(r.data);
    lines.push([new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC', r.form, r.page, r.status, ...fields.map((f) => d[f] ?? ''), r.note].map(cell).join(','));
  }
  const name = 'sos-foundation-' + (form ? form.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '') : 'leads') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' },
  });
}
