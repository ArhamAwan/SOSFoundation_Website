import './admin.css';
import { DatabaseNotConfigured, db } from '@/lib/db';

export const metadata = { title: 'SOS Foundation admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  try {
    await db();
  } catch (err) {
    if (!(err instanceof DatabaseNotConfigured)) throw err;
    return (
      <div className="auth">
        <div className="card">
          <h1>Connect the database</h1>
          <p style={{ marginBottom: 12 }}>The admin panel keeps its content in a Postgres database, and none is connected yet.</p>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>In Vercel, open this project and go to <b>Storage</b>.</li>
            <li>Create a <b>Neon</b> (Postgres) database and connect it to this project.</li>
            <li>Go to <b>Deployments</b> and redeploy the latest one.</li>
            <li>Come back to this page to create the first admin account.</li>
          </ol>
        </div>
      </div>
    );
  }
  return children;
}
