// Copies website form entries to a Google Sheet through a small Apps Script web app (setup: docs/google-sheet-setup.md).
import { getSetting, q } from './db';

/** The web app address: the SHEETS_WEBHOOK_URL environment variable if set, otherwise the one saved in the admin panel. */
export async function sheetUrl() {
  return (process.env.SHEETS_WEBHOOK_URL || (await getSetting('sheet_url', '')) || '').trim();
}

export const sheetFromEnv = () => !!(process.env.SHEETS_WEBHOOK_URL || '').trim();

/** Sends one row. Returns true when the sheet confirms it. */
export async function postRow(url, row) {
  try {
    const res = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify(row), redirect: 'follow', signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    return res.ok && /"ok"\s*:\s*true/.test(text);
  } catch {
    return false;
  }
}

/** Copies a saved submission to the sheet and records whether it arrived. No sheet connected: left as not sent. */
export async function sendSubmission(sub, url) {
  url = url || (await sheetUrl());
  if (!url) return false;
  const ok = await postRow(url, {
    form: sub.form, page: sub.page, received: new Date(sub.created_at).toISOString(), id: sub.id,
    fields: Object.fromEntries(sub.data),
  });
  await q('UPDATE submissions SET sheet = $2 WHERE id = $1', [sub.id, ok ? 'sent' : 'failed']);
  return ok;
}
