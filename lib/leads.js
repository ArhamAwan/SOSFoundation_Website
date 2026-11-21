// Leads: what people send through the website forms (table `submissions`). Shared by the Leads portal and the admin panel.
import { q } from './db';

export const FORMS = ['Volunteer Registration', 'Youth Registration', 'Brand Ambassador', 'Partnership', 'Corporate CSR', 'Contact', 'Newsletter'];
export const STATUS = { new: ['new', 'New'], 'in progress': ['progress', 'In progress'], closed: ['closed', 'Closed'] };

const when = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
export const formatWhen = (d) => when.format(new Date(d)).replace(' am', ' am').replace(' AM', ' am').replace(' PM', ' pm');

const pick = (data, test) => (data.find(([k, v]) => v && test(k.toLowerCase())) || [])[1] || '';
export const emailOf = (data) => pick(data, (k) => k.includes('email'));
export const phoneOf = (data) => pick(data, (k) => k === 'phone' || k.includes('phone'));
export const nameOf = (data) => pick(data, (k) => k.includes('name') && !k.includes('organisation')) || pick(data, (k) => k === 'contact person') || emailOf(data) || '(no name)';
export const subOf = (data) => [pick(data, (k) => k === 'organisation name'), pick(data, (k) => k === 'inquiry type'), pick(data, (k) => k === 'city')].filter(Boolean).join(' · ');

/** A Pakistani mobile number written 0300 1234567 becomes 923001234567 for WhatsApp; other numbers keep their digits. */
export function whatsappOf(phone) {
  let d = String(phone || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '92' + d.slice(1);
  return d.length >= 10 ? d : '';
}

/** Filters: form name, status ('new' | 'in progress' | 'closed'), free-text search. */
export function filters(params) {
  const form = FORMS.includes(params.form) ? params.form : String(params.form || '').slice(0, 80);
  const status = STATUS[params.status] ? params.status : '';
  const search = String(params.q || '').trim().slice(0, 100);
  return { form, status, search };
}

function where({ form, status, search }) {
  const w = [], args = [];
  if (form) { args.push(form); w.push(`form = $${args.length}`); }
  if (status) { args.push(status); w.push(`status = $${args.length}`); }
  if (search) { args.push('%' + search.toLowerCase() + '%'); w.push(`(lower(data::text) LIKE $${args.length} OR lower(note) LIKE $${args.length})`); }
  return [w.length ? 'WHERE ' + w.join(' AND ') : '', args];
}

export async function findLeads(f, limit = 500) {
  const [w, args] = where(f);
  return q(`SELECT id, form, page, data, status, created_at FROM submissions ${w} ORDER BY id DESC LIMIT ${Number(limit) || 500}`, args);
}

export async function leadCounts() {
  const [byForm, [totals]] = await Promise.all([
    q('SELECT form, count(*)::int AS n FROM submissions GROUP BY form'),
    q(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'new')::int AS fresh, count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week FROM submissions`),
  ]);
  return { byForm: Object.fromEntries(byForm.map((r) => [r.form, r.n])), ...totals };
}

export async function getLead(id) {
  const [row] = await q('SELECT * FROM submissions WHERE id = $1', [Number(id) || 0]);
  return row || null;
}

const cell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formulas running from form text
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

/** All leads matching the filters as a CSV file (opens in Excel or Google Sheets). */
export async function leadsCsv(f) {
  const [w, args] = where(f);
  const rows = await q(`SELECT * FROM submissions ${w} ORDER BY id`, args);
  const fields = [];
  for (const r of rows) for (const [k] of r.data) if (!fields.includes(k)) fields.push(k);
  const lines = [['Received', 'Form', 'Page', 'Status', ...fields, 'Private note'].map(cell).join(',')];
  for (const r of rows) {
    const d = Object.fromEntries(r.data);
    lines.push([formatWhen(r.created_at), r.form, r.page, (STATUS[r.status] || STATUS.new)[1], ...fields.map((k) => d[k] ?? ''), r.note].map(cell).join(','));
  }
  const name = 'sos-foundation-' + (f.form ? f.form.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '') : 'leads') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' },
  });
}
