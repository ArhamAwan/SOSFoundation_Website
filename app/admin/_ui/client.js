'use client';
// The few parts of the admin that need to run in the browser.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

/** A submit button that asks first. */
export function ConfirmButton({ message, className = 'btn danger', children, ...rest }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }} {...rest}>
      {children}
    </button>
  );
}

/** Warns before leaving a form with unsaved changes. Put it inside the form. */
export function UnsavedGuard() {
  const ref = useRef(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return undefined;
    let dirty = false;
    const mark = () => { dirty = true; };
    const clear = () => { dirty = false; };
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    form.addEventListener('input', mark);
    form.addEventListener('change', mark);
    form.addEventListener('submit', clear);
    window.addEventListener('beforeunload', warn);
    return () => {
      form.removeEventListener('input', mark);
      form.removeEventListener('change', mark);
      form.removeEventListener('submit', clear);
      window.removeEventListener('beforeunload', warn);
    };
  }, []);
  return <span ref={ref} hidden />;
}

/** Text box with a live character count against a target range. */
export function CountedText({ id, name, value = '', min, max, rows = 3 }) {
  const [length, setLength] = useState(value.length);
  const ok = length >= min && length <= max;
  return (
    <>
      <textarea className="ctl" id={id} name={name || id} rows={rows} defaultValue={value} onChange={(e) => setLength(e.target.value.trim().length)} />
      <span className="help" style={{ color: ok ? '#2c8a26' : undefined, fontWeight: ok ? 700 : undefined }}>
        {length} characters. The brief asks for {min} to {max}.
      </span>
    </>
  );
}

// Resize in the browser and convert to WebP, so uploads stay small and fast.
async function toWebp(file, maxSide = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  return { blob: blob || file, width, height };
}

/** Upload button for photos. Calls onDone with the new photos, then refreshes the page data. */
export function Uploader({ label = 'Upload photos', onDone, className = 'btn' }) {
  const router = useRouter();
  const input = useRef(null);
  const [state, setState] = useState({ busy: false, message: '', error: false });

  async function upload(files) {
    if (!files.length) return;
    const done = [];
    let failed = '';
    for (let i = 0; i < files.length; i++) {
      setState({ busy: true, message: `Uploading ${i + 1} of ${files.length}…`, error: false });
      try {
        const { blob, width, height } = await toWebp(files[i]);
        const form = new FormData();
        form.append('file', blob, 'photo.webp');
        form.append('name', files[i].name);
        form.append('width', width);
        form.append('height', height);
        const res = await fetch('/admin/upload', { method: 'POST', body: form });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'The upload did not go through.');
        done.push(json);
      } catch (err) {
        failed = `${files[i].name}: ${err.message}`;
        break;
      }
    }
    setState({ busy: false, error: !!failed, message: failed || `${done.length} photo${done.length === 1 ? '' : 's'} added. Add alt text before publishing.` });
    if (input.current) input.current.value = '';
    if (done.length) {
      onDone?.(done);
      router.refresh();
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload([...e.target.files])} />
      <button type="button" className={className} disabled={state.busy} onClick={() => input.current?.click()}>{label}</button>
      {state.message ? <span role="status" className="small" style={{ color: state.error ? '#b3161b' : '#55587f', fontWeight: 600 }}>{state.message}</span> : null}
    </span>
  );
}

/** Pick one photo (or several) from the media library. Writes the choice into hidden form fields. */
export function ImagePicker({ name, media, value, multiple = false, emptyLabel = 'No photo chosen' }) {
  const [ids, setIds] = useState(() => (Array.isArray(value) ? value : value ? [value] : []));
  const [extra, setExtra] = useState([]);
  const dialog = useRef(null);
  const all = [...extra.filter((e) => !media.some((m) => m.id === e.id)), ...media];
  const chosen = ids.map((id) => all.find((m) => m.id === id)).filter(Boolean);

  function toggle(id) {
    if (!multiple) {
      setIds([id]);
      dialog.current?.close();
    } else {
      setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
    // Tell the form something changed (for the unsaved-changes warning).
    dialog.current?.closest('form')?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return (
    <div>
      {(multiple ? ids : ids.slice(0, 1)).map((id) => <input key={id} type="hidden" name={name} value={id} />)}
      {chosen.length ? (
        <div className="picked">
          {chosen.map((m) => (
            <figure key={m.id}>
              <img src={m.url} alt={m.alt} />
              <button type="button" aria-label="Remove photo" onClick={() => setIds((prev) => prev.filter((x) => x !== m.id))}>×</button>
            </figure>
          ))}
        </div>
      ) : (
        <p className="muted small">{emptyLabel}</p>
      )}
      <p style={{ marginTop: 12 }}>
        <button type="button" className="btn plain" onClick={() => dialog.current?.showModal()}>{multiple ? 'Choose photos' : chosen.length ? 'Change photo' : 'Choose photo'}</button>
      </p>
      <dialog className="picker" ref={dialog}>
        <div className="toolbar">
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>{multiple ? 'Choose photos' : 'Choose a photo'}</h2>
          <button type="button" className="btn plain" onClick={() => dialog.current?.close()}>{multiple ? 'Done' : 'Cancel'}</button>
        </div>
        <p style={{ marginBottom: 16 }}>
          <Uploader label="Upload new" className="btn plain" onDone={(done) => { setExtra((prev) => [...done.map((d) => ({ id: d.id, url: d.url, alt: '', filename: d.filename })), ...prev]); done.forEach((d) => toggle(d.id)); }} />
        </p>
        <div className="mgrid">
          {all.map((m) => (
            <button type="button" key={m.id} className="mcard" aria-pressed={ids.includes(m.id)} onClick={() => toggle(m.id)}>
              <img src={m.url} alt={m.alt} loading="lazy" />
              <span>{m.alt || m.filename}</span>
            </button>
          ))}
        </div>
      </dialog>
    </div>
  );
}

// Sections that are connected to the database. The rest are still design previews and load as ordinary pages.
const CONNECTED = ['/admin', '/admin/news', '/admin/success-stories', '/admin/media', '/admin/users'];

/** The left menu. Connected sections switch without reloading the page. */
export function SideNav({ groups }) {
  const path = usePathname();
  const current = (href) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'));
  return (
    <nav className="adm-nav" aria-label="Admin sections">
      {groups.map((group) => [
        group.group ? <span key={group.group} className="adm-group">{group.group}</span> : null,
        ...group.items.map((item) => {
          const inner = <><span className="ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: item.icon }} />{item.label}</>;
          const props = { 'aria-current': current(item.href) ? 'page' : undefined };
          return CONNECTED.includes(item.href)
            ? <Link key={item.href} href={item.href} {...props}>{inner}</Link>
            : <a key={item.href} href={item.href} {...props}>{inner}</a>;
        }),
      ])}
    </nav>
  );
}
