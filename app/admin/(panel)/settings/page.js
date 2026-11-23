import { requireUser } from '@/lib/auth';
import { SITE } from '@/lib/overrides';
import { PageEditor } from '@/app/admin/_ui/pageeditor';

export default async function Settings({ searchParams }) {
  await requireUser();
  return <PageEditor path={SITE} flash={await searchParams} back={{ href: '/admin/settings', label: 'Site settings' }} />;
}
