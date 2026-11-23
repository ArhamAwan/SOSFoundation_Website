import Link from '@/app/admin/_ui/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { BLOG_CATEGORIES, PROGRAMMES, getItem, isPreview, mediaMap } from '@/lib/content';
import { Field, Flash, Head, Select } from '@/app/admin/_ui';
import { CountedText, ImagePicker, UnsavedGuard } from '@/app/admin/_ui/client';
import { PublishBox } from '@/app/admin/_ui/lists';
import { saveItem } from '@/app/admin/actions';

export default async function BlogEditor({ params, searchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const flash = await searchParams;
  const item = id === 'new' ? { type: 'blog', status: 'draft', title: '', slug: '', data: {} } : await getItem('blog', id);
  if (!item) notFound();
  const [media, preview] = await Promise.all([mediaMap(), isPreview()]);
  const library = [...media.values()].map((m) => ({ id: m.id, url: m.url, alt: m.alt, filename: m.filename }));
  const d = item.data;
  return (
    <>
      <Head title={item.id ? 'Edit blog post' : 'New blog post'} crumb={<Link href="/admin/blog">Blog</Link>} />
      <Flash params={flash} />
      <form action={saveItem} className="edit">
        <UnsavedGuard />
        <input type="hidden" name="type" value="blog" />
        <input type="hidden" name="id" value={item.id || ''} />
        <div className="main">
          <section className="panel">
            <h2>Post</h2>
            <div className="fgrid">
              <Field label="Title" id="title" wide><input className="ctl" id="title" name="title" defaultValue={item.title} required /></Field>
              <Field label="Author name" id="author"><input className="ctl" id="author" name="author" defaultValue={d.author || ''} /></Field>
              <Field label="Author designation" id="role"><input className="ctl" id="role" name="role" defaultValue={d.role || ''} /></Field>
              <Field label="Publish date" id="date" help="Needed before the post can go live."><input className="ctl" id="date" name="date" type="date" defaultValue={d.date || ''} /></Field>
              <Field label="Category" id="category"><Select id="category" value={d.category} options={BLOG_CATEGORIES.map(([n]) => n)} blank="None" /></Field>
              <Field label="Programme tag" id="programme"><Select id="programme" value={d.programme} options={PROGRAMMES} blank="None" /></Field>
              <Field label="Body" id="body" wide help="Leave an empty line between paragraphs. Reading time is worked out from the length."><textarea className="ctl" id="body" name="body" rows={16} defaultValue={d.body || ''} /></Field>
              <Field label="Excerpt" id="excerpt" wide help="Shown on the post's card on the Blog page. Leave empty to use the start of the body."><textarea className="ctl" id="excerpt" name="excerpt" rows={3} defaultValue={d.excerpt || ''} /></Field>
            </div>
          </section>
          <section className="panel">
            <h2>Search and sharing</h2>
            <div className="fgrid">
              <Field label="Slug" id="slug" wide help={`The last part of the page address: /blog/${item.slug || 'made-from-the-title'}. Leave empty to make it from the title.`}><input className="ctl" id="slug" name="slug" defaultValue={item.slug} /></Field>
              <Field label="Meta description" id="meta_description" wide><CountedText id="meta_description" value={d.meta_description || ''} min={150} max={160} /></Field>
              <Field label="Opens another page instead" id="link" wide help="Optional. For a post that is a success story told elsewhere on the site, for example /our-impact/success-stories/clean-water-for-mumtazabad. The card then opens that page and the post has no page of its own.">
                <input className="ctl" id="link" name="link" defaultValue={d.link || ''} placeholder="/our-impact/success-stories/…" />
              </Field>
            </div>
          </section>
        </div>
        <div className="side">
          <PublishBox item={item} media={media} preview={preview} isAdmin={user.isAdmin} />
          <section className="panel">
            <h2>Featured image</h2>
            <ImagePicker name="image" media={library} value={d.image} />
            <p className="small muted" style={{ marginTop: 12 }}>Alt text and the photo credit are set on the photo itself in the <a href="/admin/media">Media library</a>.</p>
          </section>
        </div>
      </form>
    </>
  );
}
