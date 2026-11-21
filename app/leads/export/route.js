// Download the leads in the current view (form, status, search) as a CSV file.
import { getUser } from '@/lib/auth';
import { filters, leadsCsv } from '@/lib/leads';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await getUser();
  if (!user) return new Response(null, { status: 303, headers: { location: '/leads/login' } });
  return leadsCsv(filters(Object.fromEntries(new URL(request.url).searchParams)));
}
