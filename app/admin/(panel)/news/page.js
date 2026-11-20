import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatDate, isPreview, listItems, mediaMap } from '@/lib/content';
import { Badge, Flash, Head, Icon } from '@/app/admin/_ui';
import { ListFilters, RowActions, filterItems, statusOf } from '@/app/admin/_ui/lists';

export default async function NewsList({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const [items, media, preview] = await Promise.all([listItems('news'), mediaMap(), isPreview()]);
  const { rows, counts } = filterItems(items, media, params);
  return (
    <>
      <Head title="News and Events" sub="Posts shown on the News and Events page, newest first.">
        <Link className="btn" href="/admin/news/new"><Icon name="plus" />Add news post</Link>
      </Head>
      <Flash params={params} />
      <ListFilters base="/admin/news" params={params} counts={counts} />
      <div className="tablewrap">
        <table className="tbl">
          <thead><tr><th scope="col">Post</th><th scope="col">Category</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
          <tbody>
            {rows.map((item) => {
              const photo = media.get(item.data.image);
              const st = statusOf(item, media, preview);
              return (
                <tr key={item.id}>
                  <td><div className="cell">
                    {photo ? <img className="thumb" src={photo.url} alt="" style={{ objectPosition: photo.pos }} /> : <span className="thumb empty" />}
                    <div><Link href={`/admin/news/${item.id}`}>{item.title}</Link>{item.data.home ? <> <Badge kind="info">{item.data.home === true ? 'On Home page' : `Home page ${item.data.home}`}</Badge></> : null}{st.issues.length ? <span className="small" style={{ display: 'block', color: '#b3161b' }}>{st.issues.join(' · ')}</span> : null}</div>
                  </div></td>
                  <td>{item.data.category || <span className="muted">None</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.data.date) || <span className="muted">No date</span>}</td>
                  <td><Badge kind={st.kind}>{st.label}</Badge></td>
                  <td><RowActions item={item} media={media} preview={preview} isAdmin={user.isAdmin} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty-state">{items.length ? 'No posts match this filter.' : 'No news posts yet. Add the first one.'}</p> : null}
      </div>
    </>
  );
}
