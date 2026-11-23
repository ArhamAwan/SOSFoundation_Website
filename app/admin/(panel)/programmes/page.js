import { requireUser } from '@/lib/auth';
import { PageList } from '@/app/admin/_ui/pagelist';

export default async function Programmes() {
  await requireUser();
  return <PageList section="programmes" back="/admin/programmes" title="Programmes" sub="The Our Programmes page and the nine programme pages: their text and photos." />;
}
