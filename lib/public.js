// Builds the public pages. The layouts come from the approved designs (lib/generated); news and success stories are filled from the database.
import pages from './generated/pages.json';
import templates from './generated/templates.json';
import { PARTNER_CATEGORIES, fileSize, formatDate, isLive, isPreview, listItems, mediaMap, paragraphs, photoVisible, storyBlocks, storyMeta, youtubeId } from './content';
import { fileUrl, filesById } from './files';

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

/** Home: the fixed design, with its news section filled from the database: posts given a Home page position first, in that order, then the newest; three in all, the first large. */
export async function homePage() {
  const { items, media, preview } = await live('news');
  const card = (i) => {
    const d = i.data;
    return { slug: esc(i.slug), title: esc(i.title), tag: esc(formatDate(d.date) || d.category || 'Latest'), excerpt: esc(describe('', paragraphs(d.body)[0])),
      ...photoCtx(media.get(d.image), preview) };
  };
  // "Home page position" 1-3 on a news post puts it in that place (1 is shown large); empty places get the newest other posts.
  const pos = (i) => (i.data.home === true ? 9 : Number(i.data.home) || 0);
  const picked = items.filter((i) => pos(i) > 0).sort((a, b) => pos(a) - pos(b));
  const top = [...picked, ...items.filter((i) => !pos(i))].slice(0, 3).map(card);
  return fill(templates.home, { first: top.slice(0, 1), rest: top.slice(1), ...(await homePartners()) });
}

// ---------------------------------------------------------------- partners
const SOS_GROUP = 'SOS Group of Companies';

async function livePartners() {
  const { items, media, preview } = await live('partner');
  return items.map((i) => {
    const logo = media.get(i.data.logo);
    return { item: i, name: esc(i.title), logo: photoVisible(logo, preview) ? esc(logo.url) : '', url: esc(i.data.url || ''), mou: !!i.data.mou, category: i.data.category || 'Other partners' };
  });
}

/** Home: two moving strips of logos, partners first and SOS Group of Companies second. A short strip is repeated so it is wider than the screen. */
async function homePartners() {
  const all = (await livePartners()).filter((p) => p.logo && p.item.data.home !== false);
  const strip = (list) => {
    const k = list.length > 10 ? 1 : 2;
    return Array.from({ length: 2 * k - 1 }, () => list).flat();
  };
  const p1 = all.filter((p) => p.category !== SOS_GROUP);
  const p2 = all.filter((p) => p.category === SOS_GROUP);
  return { p1, p1c: strip(p1), p2, p2c: strip(p2), p2label: esc(SOS_GROUP) };
}

export async function partnershipsPage() {
  const all = await livePartners();
  const names = [...PARTNER_CATEGORIES.filter((c) => c !== SOS_GROUP), ...new Set(all.map((p) => p.category).filter((c) => !PARTNER_CATEGORIES.includes(c))), SOS_GROUP];
  const cats = names.map((cat) => ({ cat: esc(cat), note: cat === SOS_GROUP, tiles: all.filter((p) => p.category === cat) })).filter((c) => c.tiles.length);
  return fill(templates.partnerships, { cats, tabs: cats.map((c) => ({ cat: c.cat })) });
}

// ---------------------------------------------------------------- media and gallery
const albumPhotos = (item, media, preview) => {
  const ids = item.data.gallery?.length ? item.data.gallery : [item.data.image];
  return ids.map((id) => media.get(id)).filter((m) => photoVisible(m, preview));
};

export async function galleryPage() {
  const [albums, videos, materials, coverage] = await Promise.all(['album', 'video', 'material', 'coverage'].map(live));
  const { media, preview } = albums;
  const files = await filesById(materials.items.map((i) => i.data.file));
  const events = [];
  for (const c of coverage.items) {
    const m = media.get(c.data.image);
    if (!photoVisible(m, preview)) continue;
    const name = c.data.event || 'In the news';
    let ev = events.find((e) => e.name === name);
    if (!ev) events.push((ev = { name, event: esc(name), clips: [] }));
    ev.clips.push({ img: esc(m.url), alt: esc(m.alt || `Press clipping from ${c.title}.`), outlet: esc(c.title), url: esc(c.data.url || '') });
  }
  return fill(templates.gallery, {
    albums: albums.items.map((a) => {
      const n = albumPhotos(a, media, preview).length;
      return { slug: esc(a.slug), title: esc(a.title), programme: esc(a.data.programme), count: n > 1 ? `${n} photos` : '', ...photoCtx(media.get(a.data.image), preview) };
    }),
    videos: videos.items.filter((v) => youtubeId(v.data.youtube)).map((v) => ({ yt: youtubeId(v.data.youtube), title: esc(v.title), programme: esc(v.data.programme) })),
    materials: materials.items.map((i) => {
      const f = files.get(Number(i.data.file));
      const pic = photoCtx(media.get(i.data.image), preview);
      return { title: esc(i.title), programme: esc(i.data.programme), ...pic, href: f ? esc(fileUrl(f)) : '', size: f ? `${f.content_type === 'application/pdf' ? 'PDF' : 'image'}, ${fileSize(f.size)}` : '' };
    }).filter((m) => m.href || m.img),
    events,
  });
}

export async function albumPage(slug) {
  const { items, media, preview } = await live('album');
  const item = items.find((i) => i.slug === slug);
  if (!item) return null;
  const photos = albumPhotos(item, media, preview);
  const cover = photoCtx(media.get(item.data.image), preview);
  return fill(templates.album, {
    title: esc(item.title), meta: esc([item.data.programme, formatDate(item.data.date)].filter(Boolean).join(' · ')),
    metadesc: esc(`Photos from ${item.title}${item.data.programme ? ', part of ' + item.data.programme : ''}, by SOS Foundation.`), img: cover.img,
    photos: photos.map((m) => ({ img: esc(m.url), alt: esc(m.alt), pos: esc(m.pos || 'center'), credit: esc(m.credit) })),
  });
}

// ---------------------------------------------------------------- blog
function blogCard(item, media, preview) {
  const d = item.data;
  const linked = !!d.link;
  return { title: esc(item.title), href: esc(linked ? d.link : `/blog/${item.slug}`), cat: esc([d.category, d.programme].filter(Boolean).join(' · ')),
    excerpt: esc(d.excerpt || describe('', paragraphs(d.body)[0])), more: linked && d.link.includes('/success-stories/') ? 'Read the story' : 'Read the post',
    ...photoCtx(media.get(d.image), preview) };
}

export async function blogListPage() {
  const { items, media, preview } = await live('blog');
  return fill(templates.blog, { cards: items.map((i) => blogCard(i, media, preview)) });
}

export async function blogPostPage(slug) {
  const { items, media, preview } = await live('blog');
  const item = items.find((i) => i.slug === slug && !i.data.link);
  if (!item) return null;
  const d = item.data;
  const words = String(d.body || '').split(/\s+/).filter(Boolean).length;
  const photo = photoCtx(media.get(d.image), preview);
  const m = media.get(d.image);
  return fill(templates['blog-post'], {
    title: esc(item.title), metadesc: esc(describe(d.meta_description, paragraphs(d.body)[0])),
    sub: esc([d.category, formatDate(d.date), words ? `${Math.max(1, Math.round(words / 200))} min read` : ''].filter(Boolean).join(' · ')),
    author: esc(d.author), role: esc(d.role), ...photo, credit: photo.img && m ? esc(m.credit) : '',
    paras: paragraphs(d.body).map((text) => ({ text: esc(text) })),
    cards: items.filter((i) => i !== item).slice(0, 3).map((i) => blogCard(i, media, preview)),
  });
}

// ---------------------------------------------------------------- reports and publications
export async function reportsPage() {
  const { items, media, preview } = await live('report');
  const files = await filesById(items.map((i) => i.data.file));
  const docs = items.map((i) => {
    const f = files.get(Number(i.data.file));
    if (!f) return null;
    return { type: esc(i.data.type || 'Publications'), year: esc(i.data.year || ''), title: esc(i.title), desc: esc(i.data.description || ''),
      href: esc(fileUrl(f)), size: fileSize(f.size), ...photoCtx(media.get(i.data.image), preview) };
  }).filter(Boolean);
  return fill(templates.reports, { docs, types: [...new Set(docs.map((d) => d.type))].map((type) => ({ type })) });
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

// The live website's address. Pages there can be found by search engines; the Vercel demo and staging copies cannot.
export const LIVE_HOSTS = ['sosfoundation.org.pk', 'www.sosfoundation.org.pk'];

/** The address visitors used (behind Vercel or cPanel's Passenger the server's own address is not the public one). */
export function originOf(request) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host).split(',')[0].trim();
  const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(host);
  // Public addresses are always served over HTTPS (Next's own server reports http behind Passenger).
  return `${local ? 'http' : 'https'}://${host}`;
}

/** On the live address, let search engines index the page. */
export function publicCopy(page, origin) {
  const host = origin.replace(/^https?:\/\//, '');
  return LIVE_HOSTS.includes(host) ? page.replace('<meta name="robots" content="noindex,nofollow">', '') : page;
}
