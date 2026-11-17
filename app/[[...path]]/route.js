// Every public page, and the admin sections that are still design previews, are served from here.
import { getUser } from '@/lib/auth';
import { DatabaseNotConfigured } from '@/lib/db';
import { esc, newsListPage, newsPostPage, staticPage, storiesListPage, storyPage } from '@/lib/public';

export const dynamic = 'force-dynamic';

const html = (body, status = 200, cache = 'no-store') =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache } });

const PREVIEW_NOTE =
  '<div role="note" style="margin: 0 0 20px; padding: 12px 16px; border: 1px solid #e0b100; border-left-width: 6px; border-radius: 4px; background: #fff8db; color: #373b73; font-size: 15px; line-height: 1.5">' +
  '<strong>Design preview.</strong> This section is not connected to the database yet, so nothing on this screen saves. ' +
  'News and Events, Success Stories, Media library and Users are working.</div>';

async function adminPreview(path, request) {
  const user = await getUser();
  if (!user) return Response.redirect(new URL('/admin/login', request.url), 303);
  let page = staticPage(path);
  if (!page) return null;
  // Show who is signed in, make Sign out work, and say plainly that this screen is a preview.
  page = page
    .replace('>[A]<', '>' + esc(user.name.trim().charAt(0).toUpperCase() || 'A') + '<')
    .replace('[Your name]', esc(user.name))
    .replace(/(<span aria-hidden="true"[^>]*><\/span>)Admin(<\/span>)/, '$1' + (user.isAdmin ? 'Admin' : 'Editor') + '$2')
    .replace(/<a href="\/admin\/login"([^>]*>(?:(?!<\/a>)[\s\S])*Sign out)/, '<a href="/admin/logout"$1')
    .replace(/(<main class="adm-main"[^>]*>)/, '$1' + PREVIEW_NOTE);
  return html(page);
}

export async function GET(request, { params }) {
  const { path: parts = [] } = await params;
  const path = parts.join('/');
  if (!/^[a-z0-9\-/]*$/.test(path)) return html(staticPage('404'), 404);
  try {
    let page = null;
    if (path === 'admin' || path.startsWith('admin/')) page = await adminPreview(path, request);
    else if (path === 'news-and-events') page = await newsListPage();
    else if (path.startsWith('news-and-events/')) page = await newsPostPage(path.slice('news-and-events/'.length));
    else if (path === 'our-impact/success-stories') page = await storiesListPage();
    else if (path.startsWith('our-impact/success-stories/')) page = await storyPage(path.slice('our-impact/success-stories/'.length));
    else page = staticPage(path);
    if (page instanceof Response) return page;
    if (typeof page === 'string') return html(page, 200, path.startsWith('admin') ? 'no-store' : 'public, max-age=0, must-revalidate');
    return html(staticPage('404'), 404);
  } catch (err) {
    if (err instanceof DatabaseNotConfigured) {
      // No database yet: show the page as it was designed, so the public site never breaks.
      const fallback = path.startsWith('admin') ? null : staticPage(path);
      if (fallback) return html(fallback);
      return html('<!doctype html><meta charset="utf-8"><title>Database not connected</title><body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 80px auto; padding: 0 20px; line-height: 1.6; color: #373b73">' +
        '<h1>Database not connected</h1><p>This page reads from the database. In Vercel, open the project, go to Storage, create a Neon Postgres database and connect it to this project, then redeploy.</p></body>', 503);
    }
    throw err;
  }
}
