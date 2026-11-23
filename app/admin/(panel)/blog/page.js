import Link from '@/app/admin/_ui/link';
import { requireUser } from '@/lib/auth';
import { BLOG_CATEGORIES, formatDate, isPreview, listItems, mediaMap } from '@/lib/content';
import { Badge, Flash, Head, Icon } from '@/app/admin/_ui';
import { ListFilters, RowActions, filterItems, statusOf } from '@/app/admin/_ui/lists';

export default async function BlogList({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const [items, media, preview] = await Promise.all([listItems('blog'), mediaMap(), isPreview()]);
  const { rows, counts } = filterItems(items, media, params);
  return (
    <>
      <Head title="Blog" sub="Longer articles shown on the Blog page, newest first.">
        <Link className="btn" href="/admin/blog/new"><Icon name="plus" />New post</Link>
      </Head>
      <Flash params={params} />
      <ListFilters base="/admin/blog" params={params} counts={counts} />
      <div className="edit">
        <div className="main tablewrap">
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
                      <div><Link href={`/admin/blog/${item.id}`}>{item.title}</Link>
                        {item.data.link ? <span className="small muted" style={{ display: 'block' }}>Opens {item.data.link}</span> : null}
                        {st.issues.length ? <span className="small" style={{ display: 'block', color: '#b3161b' }}>{st.issues.join(' · ')}</span> : null}</div>
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
          {rows.length === 0 ? <p className="empty-state">{items.length ? 'No posts match this filter.' : 'No blog posts yet. Write the first one.'}</p> : null}
        </div>
        <div className="side">
          <section className="panel">
            <h2>Categories</h2>
            <dl style={{ margin: 0, display: 'grid', gap: 12 }}>
              {BLOG_CATEGORIES.map(([name, text]) => <div key={name}><dt style={{ fontWeight: 700 }}>{name}</dt><dd className="small muted" style={{ margin: 0 }}>{text}</dd></div>)}
            </dl>
          </section>
          <section className="panel">
            <h2>Publishing standards</h2>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
              <li>Publish one to two posts each month to keep the blog active.</li>
              <li>Every post is original, factual and reviewed before publishing; it should not repeat News and Events text word for word.</li>
              <li>Cite credible sources for all statistics.</li>
              <li>Use only images with proper usage rights, credits and alt text; each post needs a 150 to 160 character meta description.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
