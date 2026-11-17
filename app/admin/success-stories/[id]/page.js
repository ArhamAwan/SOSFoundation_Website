import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { PROGRAMMES, getItem, isPreview, mediaMap } from '@/lib/content';
import { Check, Field, Flash, Head, Select, Shell } from '../../_ui';
import { ImagePicker, UnsavedGuard } from '../../_ui/client';
import { PublishBox } from '../../_ui/lists';
import { saveItem } from '../../actions';

export default async function StoryEditor({ params, searchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const flash = await searchParams;
  const item = id === 'new' ? { type: 'story', status: 'draft', title: '', slug: '', data: {} } : await getItem('story', id);
  if (!item) notFound();
  const [media, preview] = await Promise.all([mediaMap(), isPreview()]);
  const library = [...media.values()].map((m) => ({ id: m.id, url: m.url, alt: m.alt, filename: m.filename }));
  const d = item.data;
  return (
    <Shell user={user} current="/admin/success-stories">
      <Head title={item.id ? 'Edit success story' : 'Add success story'} crumb={<Link href="/admin/success-stories">Success Stories</Link>} />
      <Flash params={flash} />
      <form action={saveItem} className="edit">
        <UnsavedGuard />
        <input type="hidden" name="type" value="story" />
        <input type="hidden" name="id" value={item.id || ''} />
        <div className="main">
          <section className="panel">
            <h2>Story</h2>
            <div className="fgrid">
              <Field label="Title" id="title" wide><input className="ctl" id="title" name="title" defaultValue={item.title} required /></Field>
              <Field label="Programme" id="programme"><Select id="programme" value={d.programme} options={PROGRAMMES} blank="Choose a programme" /></Field>
              <Field label="Focus" id="focus" help="Optional. Shown after the programme, for example Adult Literacy."><input className="ctl" id="focus" name="focus" defaultValue={d.focus || ''} /></Field>
              <Field label="Location" id="location"><input className="ctl" id="location" name="location" defaultValue={d.location || ''} /></Field>
              <Field label="Partner(s)" id="partners" help="For example: In collaboration with …"><input className="ctl" id="partners" name="partners" defaultValue={d.partners || ''} /></Field>
              <Field label="Story" id="body" wide help='Leave an empty line between paragraphs. Start a paragraph with ">" to show it as the beneficiary quote, including who said it.'>
                <textarea className="ctl" id="body" name="body" rows={16} defaultValue={d.body || ''} />
              </Field>
              <Field label="Slug" id="slug" wide help={`The last part of the page address: /our-impact/success-stories/${item.slug || 'made-from-the-title'}. Leave empty to make it from the title.`}><input className="ctl" id="slug" name="slug" defaultValue={item.slug} /></Field>
            </div>
          </section>
        </div>
        <div className="side">
          <PublishBox item={item} media={media} preview={preview} isAdmin={user.isAdmin} />
          <section className="panel">
            <h2>Photo</h2>
            <ImagePicker name="image" media={library} value={d.image} />
            <div style={{ marginTop: 16 }}>
              <Field label="Shape on the story page" id="layout">
                <select className="ctl" id="layout" name="layout" defaultValue={d.layout || 'portrait'}>
                  <option value="portrait">Tall, beside the text</option>
                  <option value="landscape">Wide, above the text</option>
                </select>
              </Field>
            </div>
          </section>
          <section className="panel">
            <h2>Display and consent</h2>
            <Check name="consent_confirmed" label="Consent confirmed" note="Internal only. The person in the story, or a parent or guardian, has agreed to it being published." on={d.consent_confirmed} />
            <Check name="featured" label="Featured on Home" note="Saved now; the Home page section is connected in the next stage." on={d.featured} />
          </section>
        </div>
      </form>
    </Shell>
  );
}
