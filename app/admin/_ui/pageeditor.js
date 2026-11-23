// The editor for a fixed page's text and photos (Pages, Programmes, Board and messages, Site settings).
// Fields come from lib/generated/fields.json; saved edits from lib/overrides.js. Design: the "Admin: Page editor" board.
import Link from '@/app/admin/_ui/link';
import { mediaMap } from '@/lib/content';
import { SITE, pageEdits, pageFields } from '@/lib/overrides';
import { Badge, Field, Flash, Head } from '@/app/admin/_ui';
import { CountedText, ImagePicker, UnsavedGuard } from '@/app/admin/_ui/client';
import { savePage } from '@/app/admin/actions';

const ONE_LINE = new Set(['h1', 'h2', 'h3', 'h4', 'th', 'dt']);
const SINGLE = new Set(['phone', 'email', 'url']);

export const publicHref = (path) => (path === SITE ? '/' : '/' + path);

function current(field, edit) {
  if (!edit) return field.kind === 'image' ? '' : field.md;
  if (field.kind === 'phone' || field.kind === 'email') return edit.text;
  if (field.kind === 'url') return edit.url;
  return edit.md;
}

export async function PageEditor({ path, flash, back }) {
  const man = pageFields(path);
  const [edits, media] = await Promise.all([pageEdits(path), mediaMap()]);
  const library = [...media.values()].map((m) => ({ id: m.id, url: m.url, alt: m.alt, filename: m.filename }));
  const sections = [];
  for (const f of man.fields) {
    const last = sections[sections.length - 1];
    if (last && last.name === f.section) last.fields.push(f);
    else sections.push({ name: f.section, fields: [f] });
  }
  const changed = Object.keys(edits.fields || {}).length + (edits.title ? 1 : 0) + (edits.description ? 1 : 0);
  const site = path === SITE;
  const name = site ? 'Site settings' : man.title.split(' | ')[0] || 'Home';
  let n = 0;
  return (
    <>
      <Head title={site ? 'Site settings' : `Edit page: ${name}`} sub={site ? 'Contact details and social links in the footer of every page.' : null}
        crumb={site ? null : <Link href={back.href}>{back.label}</Link>}>
        <a className="btn plain" href={publicHref(path)} target="_blank" rel="noreferrer">View page</a>
      </Head>
      <Flash params={flash} />
      <form action={savePage} className="edit">
        <UnsavedGuard />
        <input type="hidden" name="path" value={path} />
        <input type="hidden" name="back" value={back.href} />
        <div className="main">
          {sections.map((s) => (
            <section className="panel" key={s.name + s.fields[0].k}>
              <h2>{s.name}</h2>
              <div className="fgrid">
                {s.fields.map((f) => {
                  const edit = edits.fields?.[f.k];
                  const id = 'f' + n++;
                  const mark = edit ? <> <Badge kind="info">Changed</Badge></> : null;
                  const undo = edit ? (
                    <label className="check" style={{ marginTop: 6 }}><input type="checkbox" name={'reset:' + f.k} /><span>Undo my change (show the original again)</span></label>
                  ) : null;
                  if (f.kind === 'image') {
                    return (
                      <div className="field wide" key={f.k}>
                        <label>{f.label}{mark}</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
                          {!edit ? <img src={f.src} alt="" style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid #e3e6f0' }} /> : null}
                          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                            <ImagePicker name={'f:' + f.k} media={library} value={edit ? Number(edit.media) : null} emptyLabel="The website shows the photo on the left. Choose another to replace it." />
                          </div>
                        </div>
                        <Field label="Alt text" id={id + 'a'} help="Describe what the photo shows, for people who cannot see it.">
                          <input className="ctl" id={id + 'a'} name={'alt:' + f.k} defaultValue={edit?.alt ?? f.alt} />
                        </Field>
                        {undo}
                      </div>
                    );
                  }
                  const value = current(f, edit);
                  const one = SINGLE.has(f.kind) || (ONE_LINE.has(f.tag) && !value.includes('\n'));
                  return (
                    <div className="field wide" key={f.k}>
                      <label htmlFor={id}>{f.label}{mark}</label>
                      {one
                        ? <input className="ctl" id={id} name={'f:' + f.k} defaultValue={value} type={f.kind === 'email' ? 'email' : f.kind === 'url' ? 'url' : 'text'} />
                        : <textarea className="ctl" id={id} name={'f:' + f.k} defaultValue={value} rows={Math.min(10, Math.max(2, Math.ceil(value.length / 90) + (value.match(/\n/g) || []).length))} />}
                      {undo}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="side">
          <section className="panel">
            <h2>Save</h2>
            <p style={{ marginBottom: 12 }}>{changed ? <Badge kind="info">{changed} {changed === 1 ? 'change' : 'changes'} from the original</Badge> : <Badge kind="ok">As designed</Badge>}</p>
            <div className="row"><button className="btn" type="submit">Save changes</button></div>
            <p className="small muted" style={{ marginTop: 14 }}>Changes show on the website as soon as you save.</p>
          </section>
          {!site ? (
            <section className="panel">
              <h2>Search and sharing</h2>
              <div className="fgrid">
                <Field label="Page title in search results" id="meta_title" wide><input className="ctl" id="meta_title" name="meta_title" defaultValue={edits.title || man.title} /></Field>
                <Field label="Meta description" id="meta_description" wide><CountedText id="meta_description" name="meta_description" value={edits.description || man.description} min={150} max={160} /></Field>
              </div>
            </section>
          ) : null}
          <section className="panel">
            <h2>Formatting</h2>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
              <li><b>**bold**</b> for bold text</li>
              <li><i>*italic*</i> for italic text</li>
              <li>[link text](https://…) for a link</li>
              <li>Press Enter for a new line</li>
            </ul>
          </section>
        </div>
      </form>
    </>
  );
}
