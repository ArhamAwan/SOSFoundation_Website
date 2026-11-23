import Link from '@/app/admin/_ui/link';
import { requireUser } from '@/lib/auth';
import { isPreview, listItems, mediaMap } from '@/lib/content';
import { Badge, Flash, Head, Icon } from '@/app/admin/_ui';
import { ListFilters, RowActions, filterItems, statusOf } from '@/app/admin/_ui/lists';

export default async function StoryList({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const [items, media, preview] = await Promise.all([listItems('story'), mediaMap(), isPreview()]);
  const { rows, counts } = filterItems(items, media, params);
  return (
    <>
      <Head title="Success Stories" sub="Stories shown on the Success Stories page. A story needs confirmed consent before it can go live.">
        <Link className="btn" href="/admin/success-stories/new"><Icon name="plus" />Add success story</Link>
      </Head>
      <Flash params={params} />
      <ListFilters base="/admin/success-stories" params={params} counts={counts} />
      <div className="tablewrap">
        <table className="tbl">
          <thead><tr><th scope="col">Story</th><th scope="col">Programme</th><th scope="col">Location</th><th scope="col">Consent</th><th scope="col">Status</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
          <tbody>
            {rows.map((item) => {
              const photo = media.get(item.data.image);
              const st = statusOf(item, media, preview);
              return (
                <tr key={item.id}>
                  <td><div className="cell">
                    {photo ? <img className="thumb" src={photo.url} alt="" style={{ objectPosition: photo.pos }} /> : <span className="thumb empty" />}
                    <div><Link href={`/admin/success-stories/${item.id}`}>{item.title}</Link>{!photo ? <span className="small muted" style={{ display: 'block' }}>No photo</span> : null}</div>
                  </div></td>
                  <td>{item.data.programme || <span className="muted">None</span>}</td>
                  <td>{item.data.location || <span className="muted">None</span>}</td>
                  <td>{item.data.consent_confirmed ? 'Confirmed' : <span style={{ color: '#b3161b', fontWeight: 700 }}>Not confirmed</span>}</td>
                  <td><Badge kind={st.kind}>{st.label}</Badge></td>
                  <td><RowActions item={item} media={media} preview={preview} isAdmin={user.isAdmin} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty-state">{items.length ? 'No stories match this filter.' : 'No success stories yet. Add the first one.'}</p> : null}
      </div>
    </>
  );
}
