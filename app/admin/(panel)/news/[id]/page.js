import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { NEWS_CATEGORIES, PROGRAMMES, getItem, isPreview, mediaMap } from '@/lib/content';
import { Field, Flash, Head, Select } from '@/app/admin/_ui';
import { CountedText, ImagePicker, UnsavedGuard } from '@/app/admin/_ui/client';
import { PublishBox } from '@/app/admin/_ui/lists';
import { saveItem } from '@/app/admin/actions';

export default async function NewsEditor({ params, searchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const flash = await searchParams;
  const item = id === 'new' ? { type: 'news', status: 'draft', title: '', slug: '', data: {} } : await getItem('news', id);
  if (!item) notFound();
  const [media, preview] = await Promise.all([mediaMap(), isPreview()]);
  const library = [...media.values()].map((m) => ({ id: m.id, url: m.url, alt: m.alt, filename: m.filename }));
  const d = item.data;
  return (
    <>
      <Head title={item.id ? 'Edit news post' : 'Add news post'} crumb={<Link href="/admin/news">News and Events</Link>} />
      <Flash params={flash} />
      <form action={saveItem} className="edit">
        <UnsavedGuard />
        <input type="hidden" name="type" value="news" />
        <input type="hidden" name="id" value={item.id || ''} />
        <div className="main">
          <section className="panel">
            <h2>Post</h2>
            <div className="fgrid">
              <Field label="Title" id="title" wide><input className="ctl" id="title" name="title" defaultValue={item.title} required /></Field>
              <Field label="Date" id="date" help="Needed before the post can go live."><input className="ctl" id="date" name="date" type="date" defaultValue={d.date || ''} /></Field>
              <Field label="Location" id="location"><input className="ctl" id="location" name="location" defaultValue={d.location || ''} /></Field>
              <Field label="Category" id="category"><Select id="category" value={d.category} options={NEWS_CATEGORIES} blank="None" /></Field>
              <Field label="Programme tag" id="programme"><Select id="programme" value={d.programme} options={PROGRAMMES} blank="None" /></Field>
              <Field label="Partner(s)" id="partners" wide><input className="ctl" id="partners" name="partners" defaultValue={d.partners || ''} /></Field>
              <Field label="Body" id="body" wide help="Leave an empty line between paragraphs."><textarea className="ctl" id="body" name="body" rows={14} defaultValue={d.body || ''} /></Field>
            </div>
          </section>
          <section className="panel">
            <h2>Photo gallery</h2>
            <p className="muted small" style={{ marginBottom: 12 }}>Extra photos shown under the text. Optional.</p>
            <ImagePicker name="gallery" media={library} value={d.gallery || []} multiple emptyLabel="No gallery photos" />
          </section>
          <section className="panel">
            <h2>Search and sharing</h2>
            <div className="fgrid">
              <Field label="Slug" id="slug" wide help={`The last part of the page address: /news-and-events/${item.slug || 'made-from-the-title'}. Leave empty to make it from the title.`}><input className="ctl" id="slug" name="slug" defaultValue={item.slug} /></Field>
              <Field label="Meta description" id="meta_description" wide><CountedText id="meta_description" value={d.meta_description || ''} min={150} max={160} /></Field>
            </div>
          </section>
        </div>
        <div className="side">
          <PublishBox item={item} media={media} preview={preview} isAdmin={user.isAdmin} />
          <section className="panel">
            <h2>Home page</h2>
            <Field label="Position on the Home page" id="home" help="The Home page shows three news posts. Position 1 is shown large. Places left empty show the newest other posts.">
              <select className="ctl" id="home" name="home" defaultValue={String(d.home === true ? 3 : Number(d.home) || 0)}>
                <option value="0">Not on the Home page</option>
                <option value="1">1 (large)</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </Field>
          </section>
          <section className="panel">
            <h2>Featured photo</h2>
            <ImagePicker name="image" media={library} value={d.image} />
            <div style={{ marginTop: 16 }}>
              <Field label="Caption" id="caption" help="Shown under the photo on the post."><textarea className="ctl" id="caption" name="caption" rows={2} defaultValue={d.caption || ''} /></Field>
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>Alt text, consent and the focal point are set on the photo itself in the <a href="/admin/media">Media library</a>.</p>
          </section>
        </div>
      </form>
    </>
  );
}
