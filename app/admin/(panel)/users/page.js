import { requireAdmin } from '@/lib/auth';
import { q } from '@/lib/db';
import { MIN_PASSWORD } from '@/lib/password';
import { Badge, Check, Field, Flash, Head, Icon } from '@/app/admin/_ui';
import { ConfirmButton } from '@/app/admin/_ui/client';
import { createUser, deleteUser, updateUser } from '@/app/admin/actions';

const PERMISSIONS = [
  ['Add and edit content', true, true], ['Publish and unpublish', true, true], ['Upload and edit photos', true, true],
  ['Delete content or photos', true, false], ['Switch the website between preview and live', true, false], ['Manage users', true, false],
];
const when = (d) => (d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' }) : 'Never');

export default async function Users({ searchParams }) {
  const me = await requireAdmin();
  const params = await searchParams;
  const users = await q('SELECT id, name, email, role, active, last_login_at FROM users ORDER BY name');
  const editing = users.find((u) => u.id === Number(params.edit));
  return (
    <>
      <Head title="Users and roles" sub="Who can sign in and what they are allowed to do. Admins only." />
      <Flash params={params} />
      <div className="edit">
        <div className="main">
          <div className="tablewrap">
            <table className="tbl" style={{ minWidth: 640 }}>
              <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Last signed in</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700 }}>{u.name}{u.id === me.id ? <span className="muted" style={{ fontWeight: 400 }}> (you)</span> : null}</td>
                    <td>{u.email}</td>
                    <td><Badge kind={u.role === 'admin' ? 'info' : 'draft'}>{u.role === 'admin' ? 'Admin' : 'Editor'}</Badge></td>
                    <td>{u.active ? <Badge>Active</Badge> : <Badge kind="warn">Turned off</Badge>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{when(u.last_login_at)}</td>
                    <td><div className="acts">
                      <a className="iconbtn" href={`/admin/users?edit=${u.id}`} aria-label={`Edit ${u.name}`}><Icon name="edit" /></a>
                      {u.id !== me.id ? (
                        <form action={deleteUser}><input type="hidden" name="id" value={u.id} />
                          <ConfirmButton className="iconbtn danger" aria-label={`Delete ${u.name}`} message={`Delete ${u.name}? They will no longer be able to sign in.`}><Icon name="trash" /></ConfirmButton>
                        </form>
                      ) : null}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section className="panel" style={{ marginTop: 16 }}>
            <h2>What each role can do</h2>
            <table className="tbl" style={{ minWidth: 0 }}>
              <thead><tr><th scope="col">Permission</th><th scope="col">Admin</th><th scope="col">Editor</th></tr></thead>
              <tbody>{PERMISSIONS.map(([label, admin, editor]) => <tr key={label}><td>{label}</td><td>{admin ? 'Yes' : 'No'}</td><td>{editor ? 'Yes' : 'No'}</td></tr>)}</tbody>
            </table>
          </section>
        </div>
        <div className="side">
          {editing ? (
            <form action={updateUser} className="panel">
              <h2>Edit {editing.name}</h2>
              <input type="hidden" name="id" value={editing.id} />
              <div className="fgrid">
                <Field label="Name" id="name" wide><input className="ctl" id="name" name="name" defaultValue={editing.name} required /></Field>
                <Field label="Role" id="role" wide><select className="ctl" id="role" name="role" defaultValue={editing.role}><option value="editor">Editor</option><option value="admin">Admin</option></select></Field>
                <Field label="Set a new password" id="password" wide help={`Leave empty to keep the current one. At least ${MIN_PASSWORD} characters. They are signed out everywhere.`}><input className="ctl" id="password" name="password" type="password" autoComplete="new-password" /></Field>
              </div>
              <Check name="active" label="Can sign in" note="Untick to turn the account off without deleting it." on={editing.active} />
              <div className="row" style={{ marginTop: 8 }}><button className="btn" type="submit">Save user</button><a className="btn plain" href="/admin/users">Cancel</a></div>
            </form>
          ) : (
            <form action={createUser} className="panel">
              <h2>Add a user</h2>
              <div className="fgrid">
                <Field label="Name" id="name" wide><input className="ctl" id="name" name="name" required /></Field>
                <Field label="Email" id="email" wide><input className="ctl" id="email" name="email" type="email" required /></Field>
                <Field label="Role" id="role" wide><select className="ctl" id="role" name="role" defaultValue="editor"><option value="editor">Editor</option><option value="admin">Admin</option></select></Field>
                <Field label="First password" id="password" wide help={`At least ${MIN_PASSWORD} characters. Share it privately; they can change it after signing in.`}><input className="ctl" id="password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} required /></Field>
              </div>
              <p style={{ marginTop: 16 }}><button className="btn" type="submit"><Icon name="plus" />Add user</button></p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
