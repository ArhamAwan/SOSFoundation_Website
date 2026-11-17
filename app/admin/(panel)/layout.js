import { requireUser } from '@/lib/auth';
import { Shell } from '@/app/admin/_ui';

// The menu and top bar stay on screen; only the part to the right changes when you move between sections.
export default async function PanelLayout({ children }) {
  const user = await requireUser();
  return <Shell user={user}>{children}</Shell>;
}
