import './leads.css';
import { DatabaseNotConfigured, db } from '@/lib/db';

export const metadata = { title: 'Leads | SOS Foundation', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LeadsLayout({ children }) {
  try {
    await db();
  } catch (err) {
    if (!(err instanceof DatabaseNotConfigured)) throw err;
    return <div className="lp"><div className="lp-auth"><div className="card"><h1>Not connected yet</h1><p className="intro">The Leads portal needs the website database. Ask the website developer to connect it.</p></div></div></div>;
  }
  return children;
}
