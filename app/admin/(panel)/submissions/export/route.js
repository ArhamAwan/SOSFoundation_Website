// Download form submissions as a CSV file that opens in Excel or Google Sheets.
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
  const form = new URL(request.url).searchParams.get('form') || '';
  const rows = await q(`SELECT * FROM submissions ${form ? 'WHERE form = $1' : ''} ORDER BY id`, form ? [form] : []);
  const fields = [];
  for (const r of rows) for (const [k] of r.data) if (!fields.includes(k)) fields.push(k);
  const head = ['Received', 'Form', 'Page', 'Status', ...fields, 'Private note'];
  const lines = [head.map(cell).join(',')];
  for (const r of rows) {
    const d = Object.fromEntries(r.data);
    lines.push([new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC', r.form, r.page, r.status, ...fields.map((f) => d[f] ?? ''), r.note].map(cell).join(','));
  }
  const name = 'sos-foundation-' + (form ? form.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '') : 'submissions') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' },
  });
}
