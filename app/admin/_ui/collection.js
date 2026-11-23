// The list-and-editor screen used by Partners, Reports and Publications, and Gallery.
import Link from 'next/link';
import { formatDate, isPreview, listItems, mediaMap, fileSize, youtubeId } from '@/lib/content';
import { COLLECTIONS, GALLERY_TABS, hereOf } from '@/lib/collections';
import { filesById } from '@/lib/files';
import { Badge, Field, Flash, Head, Icon } from './index';
import { ConfirmButton, FileUpload, ImagePicker, UnsavedGuard } from './client';
import { statusOf } from './lists';
import { deleteEntry, saveEntry } from '../actions';

const COLUMNS = {
  partner: ['Partner', 'Website', 'MoU', 'Order'],
  report: ['Report', 'Type', 'Year', 'File', 'Status'],
  album: ['Album', 'Programme', 'Photos', 'Status'],
  video: ['Video', 'Programme', 'Date', 'Status'],
  material: ['Material', 'Programme', 'File', 'Status'],
  coverage: ['Clipping', 'Event', 'Date', 'Status'],
};

function cells(type, item, media, files) {
  const d = item.data;
  const none = (t = 'Not set') => <span className="muted">{t}</span>;
  const file = files.get(Number(d.file));
  const fileCell = file ? <span className="small">{file.content_type === 'application/pdf' ? 'PDF' : 'Image'}, {fileSize(file.size)}</span> : <span style={{ color: '#b3161b', fontWeight: 700 }}>Missing</span>;
  switch (type) {
    case 'partner': return [d.url ? <a className="small" href={d.url} target="_blank" rel="noreferrer">{d.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a> : none(), d.mou ? <Badge kind="ok">Signed</Badge> : none('No'), item.sort];
    case 'report': return [d.type || none(), d.year || none(), fileCell];
    case 'album': return [d.programme || none('None'), (d.gallery || []).length || <span className="muted">Cover only</span>];
    case 'video': return [d.programme || none('None'), formatDate(d.date) || none()];
    case 'material': return [d.programme || none('None'), d.file ? fileCell : (d.image ? <span className="small">Image only</span> : fileCell)];
    case 'coverage': return [d.event || none(), formatDate(d.date) || none()];
    default: return [];
  }
}

const thumbOf = (type, item, media) => media.get(type === 'partner' ? item.data.logo : item.data.image);

function Editor({ type, item, media, files, isAdmin }) {
  const def = COLLECTIONS[type];
  const library = [...media.values()].map((m) => ({ id: m.id, url: m.url, alt: m.alt, filename: m.filename }));
  const d = item.data || {};
  const field = (f) => {
    const id = 'f-' + f.name;
    switch (f.kind) {
      case 'text': return <Field key={f.name} label={f.label} id={id} help={f.help} wide><input className="ctl" id={id} name={f.name} defaultValue={f.name === 'title' ? item.title : d[f.name] || ''} required={f.required} /></Field>;
      case 'url': case 'youtube': return <Field key={f.name} label={f.label} id={id} help={f.help} wide><input className="ctl" id={id} name={f.name} type="url" placeholder="https://" defaultValue={d[f.name] || ''} /></Field>;
      case 'textarea': return <Field key={f.name} label={f.label} id={id} help={f.help} wide><textarea className="ctl" id={id} name={f.name} rows={4} defaultValue={d[f.name] || ''} /></Field>;
      case 'date': return <Field key={f.name} label={f.label} id={id} help={f.help}><input className="ctl" id={id} name={f.name} type="date" defaultValue={d[f.name] || ''} /></Field>;
      case 'year': return <Field key={f.name} label={f.label} id={id} help={f.help}><input className="ctl" id={id} name={f.name} inputMode="numeric" placeholder={String(new Date().getFullYear())} defaultValue={d[f.name] || ''} /></Field>;
      case 'number': return <Field key={f.name} label={f.label} id={id} help={f.help}><input className="ctl" id={id} name={f.name} type="number" defaultValue={item.id ? item.sort : ''} /></Field>;
      case 'select': return (
        <Field key={f.name} label={f.label} id={id} help={f.help}>
          <select className="ctl" id={id} name={f.name} defaultValue={d[f.name] || ''}>
            {f.blank ? <option value="">{f.blank}</option> : null}
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>);
      case 'check': case 'status': {
        const on = f.kind === 'status' ? (item.id ? item.status === 'published' : true) : (d[f.name] ?? f.default ?? false);
        return (
          <div className="field wide" key={f.name}>
            <label className="check"><input type="checkbox" name={f.name} defaultChecked={on} /><span>{f.label}{f.note ? <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>{f.note}</span> : null}</span></label>
          </div>);
      }
      case 'image': case 'images': return (
        <div className="field wide" key={f.name}>
          <span className="label">{f.label}</span>
          <ImagePicker name={f.name} media={library} value={f.kind === 'images' ? d[f.name] || [] : d[f.name] || null} multiple={f.kind === 'images'} emptyLabel={f.kind === 'images' ? 'No photos yet. The cover photo is shown on its own.' : 'None chosen'} />
          {f.help ? <span className="help">{f.help}</span> : null}
        </div>);
      case 'file': {
        const cur = files.get(Number(d[f.name]));
        return (
          <div className="field wide" key={f.name}>
            <span className="label">{f.label}</span>
            <FileUpload name={f.name} accept={f.accept} current={cur ? { id: cur.id, filename: cur.filename, size: cur.size } : null} />
            {f.help ? <span className="help">{f.help}</span> : null}
          </div>);
      }
      default: return null;
    }
  };
  return (
    <section className="panel split-ed" id="editor">
      <h2>{item.id ? `Edit ${def.noun}: ${item.title}` : def.add}</h2>
      <form action={saveEntry}>
        <UnsavedGuard />
        <input type="hidden" name="_collection" value={type} />
        <input type="hidden" name="id" value={item.id || ''} />
        <div className="fgrid">{def.fields.map(field)}</div>
        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn" type="submit">{item.id ? 'Save changes' : `Save ${def.noun}`}</button>
          {item.id ? <Link className="btn plain" href={hereOf(type)}>Cancel</Link> : null}
        </div>
      </form>
      {item.id && isAdmin ? (
        <form action={deleteEntry} style={{ marginTop: 16 }}>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="id" value={item.id} />
          <ConfirmButton className="linkbtn" style={{ color: '#b3161b' }} message={`Delete "${item.title}"? This cannot be undone.`}>Delete this {def.noun}</ConfirmButton>
        </form>
      ) : null}
    </section>
  );
}

export async function CollectionPage({ type, params, user, counts }) {
  const def = COLLECTIONS[type];
  const [items, media, preview] = await Promise.all([listItems(type), mediaMap(), isPreview()]);
  const files = await filesById(items.map((i) => i.data.file));
  const editing = params.edit === 'new' ? { type, title: '', data: {}, status: 'published' } : items.find((i) => String(i.id) === String(params.edit)) || null;
  const needle = String(params.q || '').trim().toLowerCase();
  const filt = def.filter && params[def.filter.name];
  let rows = items;
  if (filt) rows = rows.filter((i) => i.data[def.filter.name] === filt);
  if (needle) rows = rows.filter((i) => (i.title + ' ' + Object.values(i.data).filter((v) => typeof v === 'string').join(' ')).toLowerCase().includes(needle));
  const link = (extra) => hereOf(type, [extra, params.q ? 'q=' + encodeURIComponent(params.q) : ''].filter(Boolean).join('&'));
  const cols = COLUMNS[type];
  return (
    <>
      <Head title={def.title} sub={type === 'partner' || type === 'report' ? def.sub : 'Photo albums, videos, campaign materials and media coverage shown on the Media and Gallery page.'}>
        <Link className="btn" href={hereOf(type, 'edit=new') + '#editor'}><Icon name="plus" />{def.add}</Link>
      </Head>
      <Flash params={params} />
      {counts ? (
        <div className="pills" style={{ marginBottom: 16 }}>
          {GALLERY_TABS.map(([t, label]) => <a key={t} className="pill" href={hereOf(t)} aria-current={t === type ? 'true' : undefined}>{label} {counts[t]}</a>)}
        </div>
      ) : null}
      <div className="toolbar">
        {def.filter ? (
          <div className="pills">
            <a className="pill" href={link('')} aria-current={!filt ? 'true' : undefined}>All {items.length}</a>
            {def.filter.options.map((o) => <a key={o} className="pill" href={link(`${def.filter.name}=${encodeURIComponent(o)}`)} aria-current={filt === o ? 'true' : undefined}>{o} {items.filter((i) => i.data[def.filter.name] === o).length}</a>)}
          </div>
        ) : <span />}
        <form className="row" action={def.base}>
          {def.tab && def.tab !== 'album' ? <input type="hidden" name="tab" value={def.tab} /> : null}
          {filt ? <input type="hidden" name={def.filter.name} value={filt} /> : null}
          <label className="search"><span className="sr">Search</span><Icon name="Search" /><input className="ctl" type="search" name="q" placeholder="Search" defaultValue={params.q || ''} /></label>
          <button className="btn plain" type="submit">Search</button>
        </form>
      </div>
      <div className={'split' + (params.edit ? ' editing' : '')}>
        <div className="tablewrap split-list">
          <table className="tbl">
            <thead><tr>{cols.map((c) => <th key={c} scope="col">{c}</th>)}<th scope="col"><span className="sr">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((item) => {
                const photo = thumbOf(type, item, media);
                const st = statusOf(item, media, preview);
                const status = item.status !== 'published' ? <Badge kind="draft">Hidden</Badge> : <Badge kind={st.kind}>{st.label}</Badge>;
                const rest = cells(type, item, media, files);
                return (
                  <tr key={item.id} aria-current={editing?.id === item.id ? 'true' : undefined}>
                    <td><div className="cell">
                      {type === 'video' ? null : photo ? <img className={'thumb' + (type === 'partner' ? ' logo' : '')} src={photo.url} alt="" style={{ objectPosition: photo.pos }} /> : <span className="thumb empty" />}
                      <div><Link href={hereOf(type, `edit=${item.id}`) + '#editor'}>{item.title}</Link>{type === 'partner' ? <span className="small muted" style={{ display: 'block' }}>{item.data.category}</span> : null}{type === 'partner' && item.status !== 'published' ? <> <Badge kind="draft">Hidden</Badge></> : null}{st.issues.length ? <span className="small" style={{ display: 'block', color: '#b3161b' }}>{st.issues.join(' · ')}</span> : null}</div>
                    </div></td>
                    {rest.map((c, i) => <td key={i}>{c}</td>)}
                    {type === 'partner' ? null : <td>{status}</td>}
                    <td><div className="acts">
                      <Link className="iconbtn" href={hereOf(type, `edit=${item.id}`) + '#editor'} aria-label={`Edit ${item.title}`}><Icon name="edit" /></Link>
                      {user.isAdmin ? (
                        <form action={deleteEntry}>
                          <input type="hidden" name="type" value={type} />
                          <input type="hidden" name="id" value={item.id} />
                          <ConfirmButton className="iconbtn danger" aria-label={`Delete ${item.title}`} message={`Delete "${item.title}"? This cannot be undone.`}><Icon name="trash" /></ConfirmButton>
                        </form>
                      ) : null}
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="empty-state">{items.length ? 'Nothing matches this filter.' : `No ${def.noun}s yet. Add the first one with the form.`}</p> : null}
        </div>
        <Editor key={editing?.id || 'new'} type={type} item={editing || { type, title: '', data: {}, status: 'published' }} media={media} files={files} isAdmin={user.isAdmin} />
      </div>
    </>
  );
}
