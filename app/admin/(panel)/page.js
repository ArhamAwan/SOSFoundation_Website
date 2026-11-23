import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { formatDate, isLive, isPreview, issuesOf, listItems, mediaMap } from '@/lib/content';
import seed from '@/lib/generated/seed.json';
import { Badge, Flash, Head, Icon } from '@/app/admin/_ui';
import { ConfirmButton } from '@/app/admin/_ui/client';
import { setPreviewMode } from '@/app/admin/actions';

export default async function Dashboard({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const [news, stories, media, preview, [{ n: users }], [{ n: newSubs }], kinds] = await Promise.all([listItems('news'), listItems('story'), mediaMap(), isPreview(), q('SELECT count(*)::int AS n FROM users WHERE active'), q(`SELECT count(*)::int AS n FROM submissions WHERE status = 'new'`),
    q(`SELECT type, count(*)::int AS n FROM items GROUP BY type`)]);
  const of = (t) => Number(kinds.find((k) => k.type === t)?.n || 0);
  const photos = [...media.values()];
  const count = (items, test) => items.filter(test).length;
  const has = (item, word) => issuesOf(item, media).some((i) => i.includes(word));

  const todo = [
    [count(news, (i) => has(i, 'No date')), (n) => `${n} news post${n === 1 ? ' has' : 's have'} no date`, 'A post needs a date before it can go live.', '/admin/news?show=issues'],
    [count(news, (i) => has(i, 'eta description')), (n) => `${n} news post${n === 1 ? ' needs' : 's need'} a meta description`, 'Aim for 150 to 160 characters on every post.', '/admin/news?show=issues'],
    [count(stories, (i) => !i.data.consent_confirmed), (n) => `${n} success stor${n === 1 ? 'y has' : 'ies have'} no consent confirmed`, 'A story cannot go live until consent is confirmed.', '/admin/success-stories?show=issues'],
    [count(stories, (i) => !i.data.image), (n) => `${n} success stor${n === 1 ? 'y has' : 'ies have'} no photo`, 'The website shows a placeholder until a photo is chosen.', '/admin/success-stories'],
    [count(photos, (m) => m.shows_people && !m.consent), (n) => `${n} photo${n === 1 ? ' has' : 's have'} no consent recorded`, 'Photos showing children or beneficiaries are hidden from the live website until consent is recorded.', '/admin/media?show=consent'],
    [count(photos, (m) => !m.alt.trim()), (n) => `${n} photo${n === 1 ? ' has' : 's have'} no alt text`, 'Alt text is required on every image before publishing.', '/admin/media?show=alt'],
  ].filter(([n]) => n > 0);

  const tiles = [
    [newSubs, 'New leads', '/admin/submissions'],
    [seed.counts.programmes, 'Programmes', '/admin/programmes'], [news.length, 'News and events', '/admin/news'], [of('blog'), 'Blog posts', '/admin/blog'],
    [stories.length, 'Success stories', '/admin/success-stories'], [of('report'), 'Reports', '/admin/reports'], [of('album'), 'Gallery albums', '/admin/gallery'],
    [of('partner'), 'Partners', '/admin/partners'], [photos.length, 'Photos in library', '/admin/media'], ...(user.isAdmin ? [[users, 'Users', '/admin/users']] : []),
  ];

  return (
    <>
      <Head title="Dashboard" sub="What is on the website now and what still needs your attention." />
      <Flash params={params} />
      <div className="tiles">
        {tiles.map(([n, label, href]) => <a key={label} className="tile" href={href}><b>{n}</b><span>{label}</span></a>)}
      </div>
      <div className="cols">
        <div>
          <section className="panel">
            <h2>Needs attention</h2>
            {todo.length === 0 ? <p className="muted">Nothing is waiting. Every post, story and photo meets the publishing rules.</p> : null}
            {todo.map(([n, title, note, href]) => (
              <div className="todo" key={href + title(n)}>
                <Icon name="alert" />
                <div><b>{title(n)}</b><span>{note}</span></div>
                <a href={href}>Fix</a>
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>Website mode</h2>
            <p style={{ marginBottom: 12 }}>
              <Badge kind={preview ? 'info' : 'ok'}>{preview ? 'Preview' : 'Live'}</Badge>
            </p>
            <p className="muted" style={{ marginBottom: 16 }}>
              {preview
                ? 'Preview: everything marked Published is shown on the website, even where a date, consent or description is still missing. Use this while the content is being completed.'
                : 'Live: published posts and stories with open issues, and photos of people without recorded consent, are hidden from the website.'}
            </p>
            {user.isAdmin ? (
              <form action={setPreviewMode}>
                <input type="hidden" name="mode" value={preview ? 'live' : 'preview'} />
                <ConfirmButton className="btn plain" message={preview ? 'Switch to live mode? Posts, stories and photos that do not meet the rules will be hidden from the website.' : 'Switch back to preview mode?'}>
                  {preview ? 'Switch to live mode' : 'Switch back to preview mode'}
                </ConfirmButton>
              </form>
            ) : <p className="small muted">Only an admin can change this.</p>}
          </section>
        </div>
        <div>
          <section className="panel">
            <h2>Add new</h2>
            <div className="row">
              <Link className="btn plain" href="/admin/news/new"><Icon name="plus" />News post</Link>
              <Link className="btn plain" href="/admin/success-stories/new"><Icon name="plus" />Success story</Link>
              <Link className="btn plain" href="/admin/media"><Icon name="upload" />Photos</Link>
            </div>
          </section>
          <section className="panel">
            <h2>News and events</h2>
            {news.slice(0, 5).map((item) => {
              const photo = media.get(item.data.image);
              return (
                <div className="todo" key={item.id} style={{ alignItems: 'center' }}>
                  {photo ? <img className="thumb" src={photo.url} alt="" style={{ objectPosition: photo.pos }} /> : <span className="thumb empty" />}
                  <div><Link href={`/admin/news/${item.id}`} style={{ fontSize: 15, textDecoration: 'none' }}>{item.title}</Link><span style={{ display: 'block' }}>{formatDate(item.data.date) || 'No date'}</span></div>
                  <Badge kind={item.status !== 'published' ? 'draft' : isLive(item, media, false) ? 'ok' : 'warn'}>{item.status !== 'published' ? 'Draft' : isLive(item, media, false) ? 'Published' : 'Published, has issues'}</Badge>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </>
  );
}
