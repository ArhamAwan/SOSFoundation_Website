// Builds the public pages. The layouts come from the approved designs (lib/generated); news and success stories are filled from the database.
import pages from './generated/pages.json';
import templates from './generated/templates.json';
import { formatDate, isLive, isPreview, listItems, mediaMap, paragraphs, photoVisible, storyBlocks, storyMeta } from './content';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

/** Tiny template filler: <!--if:x-->…<!--/if:x-->, <!--each:x-->…<!--/each:x--> and @@name@@. */
export function fill(tpl, ctx) {
  return tpl
    .replace(/<!--(if|each):(!?)(\w+)-->([\s\S]*?)<!--\/\1:\2\3-->/g, (_, kind, not, name, inner) => {
      const value = ctx[name];
      if (kind === 'each') return (value || []).map((item) => fill(inner, { ...ctx, ...item })).join('');
      const on = Array.isArray(value) ? value.length > 0 : !!value;
      return on !== !!not ? fill(inner, ctx) : '';
    })
    .replace(/@@(\w+)@@/g, (_, name) => ctx[name] ?? (name === 'ORIGIN' ? '@@ORIGIN@@' : ''));
}

export function staticPage(path) {
  return Object.prototype.hasOwnProperty.call(pages, path) ? pages[path] : null;
}

/** A search and share description: the editor's own, or the opening of the text cut at a word. */
const describe = (own, text) => {
  const t = String(own || text || '').replace(/\s+/g, ' ').trim();
  return t.length <= 158 ? t : t.slice(0, 156).replace(/\s+\S*$/, '') + '…';
};

const photoCtx = (m, preview) => (photoVisible(m, preview) ? { img: esc(m.url), alt: esc(m.alt), pos: esc(m.pos || 'center') } : { img: '', alt: '', pos: 'center' });

async function live(type) {
  const [items, media, preview] = await Promise.all([listItems(type), mediaMap(), isPreview()]);
  return { items: items.filter((i) => isLive(i, media, preview)), media, preview };
}

function newsCard(item, media, preview) {
  const d = item.data;
  const date = formatDate(d.date);
  return { slug: esc(item.slug), title: esc(item.title), cat: esc(d.category), date: esc(date), meta: !!(d.category || date), h3m: d.category || date ? '8px' : '20px',
    ...photoCtx(media.get(d.image), preview) };
}

export async function newsListPage() {
  const { items, media, preview } = await live('news');
  return fill(templates['news-list'], { cards: items.map((i) => newsCard(i, media, preview)) });
}

export async function newsPostPage(slug) {
  const { items, media, preview } = await live('news');
  const item = items.find((i) => i.slug === slug);
  if (!item) return null;
  const d = item.data;
  const photo = photoCtx(media.get(d.image), preview);
  return fill(templates['news-post'], {
    title: esc(item.title), metadesc: esc(describe(d.meta_description, paragraphs(d.body)[0])), sub: esc([d.category, formatDate(d.date), d.location].filter(Boolean).join(' · ')),
    ...photo, caption: esc(d.caption),
    paras: paragraphs(d.body).map((text) => ({ text: esc(text) })),
    gallery: (d.gallery || []).map((id) => media.get(id)).filter((m) => photoVisible(m, preview)).map((m) => ({ img: esc(m.url), alt: esc(m.alt) })),
    cards: items.filter((i) => i !== item).map((i) => newsCard(i, media, preview)),
  });
}

function storyCard(item, media, preview) {
  const d = item.data;
  const quote = storyBlocks(d.body).find((b) => b.kind === 'q');
  return { slug: esc(item.slug), title: esc(item.title), meta: esc(storyMeta(d)), programme: esc(d.programme), quote: esc(quote ? quote.text : ''), ...photoCtx(media.get(d.image), preview) };
}

export async function storiesListPage() {
  const { items, media, preview } = await live('story');
  const progs = [...new Set(items.map((i) => i.data.programme).filter(Boolean))].map((name) => ({ name: esc(name) }));
  return fill(templates['stories-list'], { progs, cards: items.map((i) => storyCard(i, media, preview)) });
}

export async function storyPage(slug) {
  const { items, media, preview } = await live('story');
  const item = items.find((i) => i.slug === slug);
  if (!item) return null;
  const d = item.data;
  const photo = photoCtx(media.get(d.image), preview);
  return fill(templates.story, {
    title: esc(item.title), meta: esc(storyMeta(d)), metadesc: esc(describe('', (storyBlocks(d.body).find((b) => b.kind === 'p') || {}).text)), ...photo,
    portrait: !!photo.img && d.layout !== 'landscape', landscape: !!photo.img && d.layout === 'landscape',
    items: storyBlocks(d.body).map((b) => ({ isp: b.kind === 'p', isq: b.kind === 'q', text: esc(b.text) })),
    cards: items.filter((i) => i !== item).map((i) => storyCard(i, media, preview)),
  });
}
