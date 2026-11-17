import { destroySession } from '@/lib/auth';

export async function GET(request) {
  // Browsers may fetch links ahead of a click; that must never sign anyone out.
  const purpose = (request.headers.get('sec-purpose') || request.headers.get('purpose') || '').toLowerCase();
  if (purpose.includes('prefetch') || purpose.includes('prerender')) return new Response(null, { status: 204 });
  await destroySession();
  return Response.redirect(new URL('/admin/login', request.url), 303);
}
