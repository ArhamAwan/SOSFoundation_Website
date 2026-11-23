// Content rules shared by the admin panel and the public pages.
import { cache } from 'react';
import { q, getSetting } from './db';
import seed from './generated/seed.json';

export const PROGRAMMES = seed.programmes;
export const NEWS_CATEGORIES = seed.categories;
export const TYPES = {
  news: { label: 'News post', plural: 'News and Events', admin: '/admin/news', public: '/news-and-events' },
  story: { label: 'Success story', plural: 'Success Stories', admin: '/admin/success-stories', public: '/our-impact/success-stories' },
  blog: { label: 'Blog post', plural: 'Blog', admin: '/admin/blog', public: '/blog' },
  partner: { label: 'Partner', plural: 'Partners', admin: '/admin/partners', public: '/partnerships' },
  report: { label: 'Report', plural: 'Reports and Publications', admin: '/admin/reports', public: '/reports-and-publications' },
  album: { label: 'Photo album', plural: 'Photo albums', admin: '/admin/gallery', public: '/media-gallery' },
  video: { label: 'Video', plural: 'Videos', admin: '/admin/gallery?tab=video', public: '/media-gallery' },
  material: { label: 'Campaign material', plural: 'Campaign materials', admin: '/admin/gallery?tab=material', public: '/media-gallery' },
  coverage: { label: 'Press clipping', plural: 'Media coverage', admin: '/admin/gallery?tab=coverage', public: '/media-gallery' },
};
export const BLOG_CATEGORIES = seed.blog_categories || [];
export const REPORT_TYPES = seed.report_types || [];
export const PARTNER_CATEGORIES = seed.partner_categories || [];

/** The 11-letter id of a YouTube video, from any of its usual addresses, or ''. */
export function youtubeId(url) {
  const m = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(String(url || ''));
  return m ? m[1] : '';
}

/** 1536000 -> '1.5 MB' */
export function fileSize(bytes) {
  const n = Number(bytes) || 0;
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export const slugify = (text) =>
  String(text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** '2026-09-08' -> '8 September 2026' */
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}

/** Is the site still in preview? In preview, published items show even when something is missing. */
export const isPreview = cache(async () => (await getSetting('preview_mode', true)) !== false);

export const mediaMap = cache(async function mediaMap() {
  const rows = await q('SELECT id, url, filename, alt, credit, shows_people, consent, pos, width, height FROM media ORDER BY id DESC');
  return new Map(rows.map((m) => [m.id, m]));
});

/** May this photo appear on the public site? Photos of people wait for recorded consent once the site is live. */
export const photoVisible = (m, preview) => !!m && (preview || !m.shows_people || m.consent);

/** What is missing before this item meets the brief's publishing rules. */
export function issuesOf(item, media) {
  const d = item.data || {};
  const out = [];
  const photo = d.image ? media.get(d.image) : null;
  if (item.type === 'news' || (item.type === 'blog' && !d.link)) {
    if (!d.date) out.push('No date');
    const len = (d.meta_description || '').trim().length;
    if (len < 150 || len > 160) out.push(len ? `Meta description is ${len} characters (needs 150 to 160)` : 'No meta description');
  }
  if (item.type === 'story' && !d.consent_confirmed) out.push('Consent not confirmed');
  if (item.type === 'blog' && !d.link && !String(d.body || '').trim()) out.push('No body text');
  if (item.type === 'report' && !d.file) out.push('No PDF file');
  if (item.type === 'video' && !youtubeId(d.youtube)) out.push('No YouTube link');
  if (item.type === 'material' && !d.file && !d.image) out.push('No file');
  if (photo && !photo.alt.trim()) out.push('Photo has no alt text');
  return out;
}

export const isLive = (item, media, preview) => item.status === 'published' && (preview || issuesOf(item, media).length === 0);

export async function listItems(type) {
  // News: newest date first. A post given a negative sort is pinned to the top (the BECS MoU, which has no date yet).
  const order = type === 'news' || type === 'blog' ? `CASE WHEN sort < 0 THEN 0 ELSE 1 END, (data->>'date') DESC NULLS LAST, sort, id`
    : type === 'report' ? `(data->>'year') DESC NULLS LAST, sort, id` : 'sort, id';
  return q(`SELECT i.*, u.name AS editor FROM items i LEFT JOIN users u ON u.id = i.updated_by WHERE i.type = $1 ORDER BY ${order}`, [type]);
}

export async function getItem(type, id) {
  const [row] = await q('SELECT i.*, u.name AS editor FROM items i LEFT JOIN users u ON u.id = i.updated_by WHERE i.type = $1 AND i.id = $2', [type, Number(id) || 0]);
  return row || null;
}

export async function getItemBySlug(type, slug) {
  const [row] = await q('SELECT * FROM items WHERE type = $1 AND slug = $2', [type, slug]);
  return row || null;
}

/** A slug that is not used by another item of the same type. */
export async function uniqueSlug(type, wanted, exceptId) {
  const base = slugify(wanted) || type;
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const rows = await q('SELECT id FROM items WHERE type = $1 AND slug = $2 AND id <> $3', [type, slug, exceptId || 0]);
    if (!rows.length) return slug;
  }
}

/** Story text: blank line between paragraphs; a paragraph starting with ">" is a quote. */
export function storyBlocks(body) {
  return String(body || '').split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)
    .map((t) => (t.startsWith('>') ? { kind: 'q', text: t.replace(/^>\s*/, '') } : { kind: 'p', text: t }));
}

export const paragraphs = (body) => String(body || '').split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);

export function storyMeta(d) {
  return [[d.programme, d.focus].filter(Boolean).join(', '), d.location, d.partners].filter(Boolean).join(' · ');
}
