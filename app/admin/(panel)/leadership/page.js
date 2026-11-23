import { requireUser } from '@/lib/auth';
import { PageList } from '@/app/admin/_ui/pagelist';

export default async function Leadership() {
  await requireUser();
  return <PageList section="leadership" back="/admin/leadership" title="Board and messages" sub="The Board of Trustees and the Chairman's and CEO's messages: names, roles, messages and photos." />;
}
