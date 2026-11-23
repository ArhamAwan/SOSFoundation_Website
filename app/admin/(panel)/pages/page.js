import { requireUser } from '@/lib/auth';
import { PageList } from '@/app/admin/_ui/pagelist';

export default async function Pages() {
  await requireUser();
  return <PageList section="pages" back="/admin/pages" title="Pages" sub="The text and photos of the website's fixed pages. Programme pages are under Programmes; the Board and the two messages under Board and messages." />;
}
