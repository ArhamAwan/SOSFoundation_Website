// Edits to the fixed pages' text and photos, made in the admin panel (Pages, Programmes, Board and messages, Site settings).
// tools/mark_editable.py marks every editable element with data-e="<key>" and lists them in generated/fields.json.
// A page's edits are stored in the settings table as "page:<path>"; the footer's (on every page) as "page:@site":
//   { fields: { <key>: { md } | { media, alt } | { text } | { url } }, title?, description? }
import manifest from './generated/fields.json';
import { getSetting, q, setSetting } from './db';
import { esc } from './public';

export const SITE = '@site';

/** The editable fields of a page, or null when the page has none. */
export const pageFields = (path) => manifest[path] || null;

/** All editable pages: [{ path, title, count }] in a stable order. */
export function editablePages() {
  return Object.entries(manifest).filter(([p]) => p !== SITE).map(([path, m]) => ({ path, title: m.title.split(' | ')[0] || 'Home', count: m.fields.length }));
}

export async function pageEdits(path) {
  return (await getSetting('page:' + path, null)) || { fields: {} };
}

export async function savePageEdits(path, edits) {
  await setSetting('page:' + path, edits);
}

/** **bold**, *italic*, [link](address) and line breaks; everything else is shown as typed. Links keep their original look. */
export function renderMd(md, links = {}) {
  let s = esc(md);
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
    const raw = href.replace(/&amp;/g, '&');
    if (!/^(https?:\/\/|mailto:|tel:|\/|#)/.test(raw)) return text;
    const open = links[raw] ? links[raw].replace(/href="[^"]*"/, `href="${esc(raw)}"`) : `<a href="${esc(raw)}">`;
    return open + text + '</a>';
  });
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s.replace(/\r?\n/g, '<br>');
}

const START = (k) => new RegExp(`<([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*?)\\sdata-e="${k}"((?:[^>"']|"[^"]*"|'[^']*')*)>`);
const setAttr = (tag, name, value) => (new RegExp(`\\s${name}="[^"]*"`).test(tag) ? tag.replace(new RegExp(`\\s${name}="[^"]*"`), ` ${name}="${value}"`) : tag.replace(/\s*\/?>$/, (end) => ` ${name}="${value}"${end}`));

function applyOne(page, field, edit, media) {
  const m = START(field.k).exec(page);
  if (!m) return page;
  const start = m.index;
  const startEnd = start + m[0].length;
  if (field.kind === 'image') {
    if (!edit.media) return page.slice(0, start) + setAttr(m[0], 'alt', esc(edit.alt || '')) + page.slice(startEnd);
    const photo = media.get(Number(edit.media));
    if (!photo) return page;   // the photo was deleted from the library: keep the original
    let tag = m[0].replace(/\ssrcset="[^"]*"/, '').replace(/\ssizes="[^"]*"/, '');
    tag = /\sdata-src="/.test(tag) && !/\ssrc="/.test(tag) ? setAttr(tag, 'data-src', esc(photo.url)) : setAttr(tag, 'src', esc(photo.url));
    tag = setAttr(tag, 'alt', esc(edit.alt || photo.alt || ''));
    return page.slice(0, start) + tag + page.slice(startEnd);
  }
  const close = page.indexOf(`</${m[1]}>`, startEnd);
  if (close < 0) return page;
  let open = m[0];
  let inner;
  if (field.kind === 'phone') {
    inner = esc(edit.text);
    open = setAttr(open, 'href', 'tel:' + esc(String(edit.text).replace(/[^\d+]/g, '')));
  } else if (field.kind === 'email') {
    inner = esc(edit.text);
    open = setAttr(open, 'href', 'mailto:' + esc(edit.text));
  } else if (field.kind === 'url') {
    return page.slice(0, start) + setAttr(open, 'href', esc(edit.url)) + page.slice(startEnd);
  } else {
    inner = renderMd(edit.md, field.links);
  }
  return page.slice(0, start) + open + inner + page.slice(close);
}

/** The page with its saved edits (and the site-wide ones) applied. */
export async function withEdits(page, path) {
  const sets = [[pageFields(path), await getSetting('page:' + path, null)], [pageFields(SITE), await getSetting('page:' + SITE, null)]];
  const ids = sets.flatMap(([, ed]) => Object.values(ed?.fields || {}).map((v) => Number(v.media)).filter(Boolean));
  const media = new Map();
  if (ids.length) for (const r of await q('SELECT id, url, alt FROM media WHERE id = ANY($1)', [ids])) media.set(r.id, r);
  for (const [man, ed] of sets) {
    if (!man || !ed?.fields) continue;
    for (const field of man.fields) {
      const edit = ed.fields[field.k];
      if (edit) page = applyOne(page, field, edit, media);
    }
  }
  const own = sets[0][1];
  if (own?.title) {
    const t = esc(own.title);
    page = page.replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`).replace(/(<meta property="og:title" content=")[^"]*/, `$1${t}`);
  }
  if (own?.description) {
    const d = esc(own.description);
    page = page.replace(/(<meta name="description" content=")[^"]*/, `$1${d}`).replace(/(<meta property="og:description" content=")[^"]*/, `$1${d}`);
  }
  return page;
}

const LEADERSHIP = ['about-us/board-of-trustees', 'about-us/chairman-message', 'about-us/ceo-message'];
const GROUPS = [
  ['Home', (p) => p === ''],
  ['About Us', (p) => p.startsWith('about-us')],
  ['Our Impact', (p) => p.startsWith('our-impact') || p === 'reports-and-publications'],
  ['News and Media', (p) => ['news-and-events', 'blog', 'media-gallery'].includes(p)],
  ['Partnerships', (p) => p === 'partnerships'],
  ['Get Involved and Contact', (p) => p.startsWith('get-involved') || p === 'contact-us'],
  ['Legal and other pages', () => true],
];

/** The pages a menu section lists: 'programmes', 'leadership' or 'pages' (everything else), grouped. */
export function pagesFor(section) {
  const all = editablePages();
  const pick = section === 'programmes' ? all.filter((p) => p.path === 'programmes' || p.path.startsWith('programmes/'))
    : section === 'leadership' ? LEADERSHIP.map((path) => all.find((p) => p.path === path)).filter(Boolean)
      : all.filter((p) => !(p.path === 'programmes' || p.path.startsWith('programmes/') || LEADERSHIP.includes(p.path)));
  if (section !== 'pages') return [[null, pick]];
  const out = GROUPS.map(([name]) => [name, []]);
  for (const p of pick) out[GROUPS.findIndex(([, test]) => test(p.path))][1].push(p);
  return out.filter(([, list]) => list.length);
}

/** How many fields of each page have been changed: { path: n }. */
export async function changeCounts() {
  const rows = await q("SELECT key, value FROM settings WHERE key LIKE 'page:%'");
  return Object.fromEntries(rows.map((r) => [r.key.slice(5), Object.keys(r.value?.fields || {}).length + (r.value?.title ? 1 : 0) + (r.value?.description ? 1 : 0)]));
}
