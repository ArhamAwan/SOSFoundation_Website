'use client';

export default function AdminError({ error, reset }) {
  const noDb = /database/i.test(error?.message || '');
  return (
    <div className="auth">
      <div className="card">
        <h1>{noDb ? 'Database not connected' : 'Something went wrong'}</h1>
        <p style={{ marginBottom: 16 }}>
          {noDb
            ? 'The admin panel needs its database. In Vercel, open this project, go to Storage, create a Neon Postgres database, connect it to the project and redeploy.'
            : 'The page could not be loaded. Try again; if it keeps happening, check the deployment logs.'}
        </p>
        <button type="button" className="btn" onClick={() => reset()}>Try again</button>
      </div>
    </div>
  );
}
