// Every public page, and the admin sections that are still design previews, are served from here.
import { getUser } from '@/lib/auth';
import { DatabaseNotConfigured } from '@/lib/db';
import { withEdits } from '@/lib/overrides';
import { albumPage, blogListPage, blogPostPage, esc, galleryPage, homePage, newsListPage, newsPostPage, originOf, partnershipsPage, publicCopy, reportsPage, staticPage, storiesListPage, storyPage } from '@/lib/public';

export const dynamic = 'force-dynamic';

const html = (body, status = 200, cache = 'no-store') =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache } });

const PREVIEW_NOTE =
  '<div role="note" style="margin: 0 0 20px; padding: 12px 16px; border: 1px solid #e0b100; border-left-width: 6px; border-radius: 4px; background: #fff8db; color: #373b73; font-size: 15px; line-height: 1.5">' +
  '<strong>Design preview.</strong> This screen shows the approved design only, so nothing on it saves. ' +
  'Use the menu on the left to reach the working sections.</div>';

const PREVIEW_OF = { 'admin/pages/1': '/about-us', 'admin/programmes/1': '/programmes/education-for-all', 'admin/blog/1': '/blog' };

// Layouts that are not real pages yet: the blog post layout has no posts.
const NOT_PUBLIC = new Set();

// Old addresses that moved (20 Nov 2026: Leadership became three pages).
const MOVED = { 'about-us/leadership': '/about-us/board-of-trustees' };

async function adminPreview(path, request) {
  const user = await getUser();
  if (!user) return new Response(null, { status: 303, headers: { location: '/admin/login' } });
  if (user.leadsOnly) return new Response(null, { status: 303, headers: { location: '/leads' } });
  let page = staticPage(path);
  if (!page) return null;
  // Show who is signed in, make Sign out work, and say plainly that this screen is a preview.
  page = page
    .replace('>[A]<', '>' + esc(user.name.trim().charAt(0).toUpperCase() || 'A') + '<')
    .replace('[Your name]', esc(user.name))
    .replace(/(<span aria-hidden="true"[^>]*><\/span>)Admin(<\/span>)/, '$1' + (user.isAdmin ? 'Admin' : 'Editor') + '$2')
    .replace(/<a href="\/admin\/login"([^>]*>(?:(?!<\/a>)[\s\S])*Sign out)/, '<a href="/admin/logout"$1')
    .replace(/(<main class="adm-main"[^>]*>)/, '$1' + PREVIEW_NOTE);
  // "Preview" on these editors opens the public page they belong to.
  const target = PREVIEW_OF[path];
  if (target) {
    page = page.replace(/<button( class="adm-btn")[^>]*( style="[^"]*")>((?:(?!<\/button>)[\s\S])*?Preview)<\/button>/, `<a$1 href="${target}" target="_blank" rel="noreferrer"$2>$3</a>`);
  }
  return html(page);
}

export async function GET(request, { params }) {
  const { path: parts = [] } = await params;
  const path = parts.join('/');
  const origin = originOf(request);
  const finish = (page) => publicCopy(page.replaceAll('@@ORIGIN@@', origin), origin);
  const notFound = () => html(finish(staticPage('404')), 404);
  if (MOVED[path]) return new Response(null, { status: 308, headers: { location: MOVED[path] } });
  if (!/^[a-z0-9\-/]*$/.test(path) || NOT_PUBLIC.has(path)) return notFound();
  try {
    let page = null;
    if (path === 'admin' || path.startsWith('admin/')) page = await adminPreview(path, request);
    else if (path === '') page = await homePage();
    else if (path === 'news-and-events') page = await newsListPage();
    else if (path.startsWith('news-and-events/')) page = await newsPostPage(path.slice('news-and-events/'.length));
    else if (path === 'our-impact/success-stories') page = await storiesListPage();
    else if (path.startsWith('our-impact/success-stories/')) page = await storyPage(path.slice('our-impact/success-stories/'.length));
    else if (path === 'partnerships') page = await partnershipsPage();
    else if (path === 'media-gallery') page = await galleryPage();
    else if (path.startsWith('media-gallery/')) page = await albumPage(path.slice('media-gallery/'.length));
    else if (path === 'blog') page = await blogListPage();
    else if (path.startsWith('blog/')) page = await blogPostPage(path.slice('blog/'.length));
    else if (path === 'reports-and-publications') page = await reportsPage();
    else page = staticPage(path);
    if (page instanceof Response) return page;
    if (typeof page === 'string') {
      if (!path.startsWith('admin')) page = await withEdits(page, path);   // text and photo edits from the admin panel
      page = finish(page);
      // Every public page can be edited in the admin panel, so none is kept in a shared cache: edits show up at once.
      const cache = path.startsWith('admin') ? 'no-store' : 'public, max-age=0, must-revalidate';
      return html(page, 200, cache);
    }
    return notFound();
  } catch (err) {
    if (err instanceof DatabaseNotConfigured) {
      // No database yet: show the page as it was designed, so the public site never breaks.
      const fallback = path.startsWith('admin') || path.startsWith('blog/') ? null : staticPage(path);
      if (fallback) return html(finish(fallback));
      return html('<!doctype html><meta charset="utf-8"><title>Database not connected</title><body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 80px auto; padding: 0 20px; line-height: 1.6; color: #373b73">' +
        '<h1>Database not connected</h1><p>This page reads from the database. In Vercel, open the project, go to Storage, create a Neon Postgres database and connect it to this project, then redeploy.</p></body>', 503);
    }
    throw err;
  }
}
