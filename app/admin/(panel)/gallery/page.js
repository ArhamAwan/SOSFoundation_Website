import { requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { GALLERY_TABS } from '@/lib/collections';
import { CollectionPage } from '@/app/admin/_ui/collection';

export default async function Gallery({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const type = GALLERY_TABS.some(([t]) => t === params.tab) ? params.tab : 'album';
  const rows = await q(`SELECT type, count(*)::int AS n FROM items WHERE type IN ('album', 'video', 'material', 'coverage') GROUP BY type`);
  const counts = Object.fromEntries(GALLERY_TABS.map(([t]) => [t, Number(rows.find((r) => r.type === t)?.n || 0)]));
  return <CollectionPage type={type} params={params} user={user} counts={counts} />;
}
