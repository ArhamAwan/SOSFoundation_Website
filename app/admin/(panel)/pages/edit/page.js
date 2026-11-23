import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { pageFields } from '@/lib/overrides';
import { PageEditor } from '@/app/admin/_ui/pageeditor';

const BACK = { '/admin/programmes': 'Programmes', '/admin/leadership': 'Board and messages', '/admin/pages': 'Pages' };

export default async function EditPage({ searchParams }) {
  await requireUser();
  const params = await searchParams;
  const path = String(params.p ?? '');
  if (!pageFields(path)) notFound();
  const from = BACK[params.from] ? params.from : '/admin/pages';
  return <PageEditor path={path} flash={params} back={{ href: from, label: BACK[from] }} />;
}
