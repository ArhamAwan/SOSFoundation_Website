import { requireUser } from '@/lib/auth';
import { CollectionPage } from '@/app/admin/_ui/collection';

export default async function Page({ searchParams }) {
  const user = await requireUser();
  return <CollectionPage type="partner" params={await searchParams} user={user} />;
}
