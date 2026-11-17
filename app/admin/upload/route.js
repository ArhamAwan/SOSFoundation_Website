// Receives a photo from the media library. The browser has already resized it and converted it to WebP.
import { getUser } from '@/lib/auth';
import { q } from '@/lib/db';

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

export async function POST(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Your session has ended. Sign in again.' }, { status: 401 });
  // Only accept uploads sent from this site's own pages.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) return Response.json({ error: 'Not allowed.' }, { status: 403 });

  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return Response.json({ error: 'No file received.' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: 'Upload a JPG, PNG or WebP image.' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'That image is too large (4 MB at most).' }, { status: 400 });

  const name = String(form.get('name') || file.name || 'photo').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9 _-]+/g, ' ').trim().slice(0, 80) || 'photo';
  const bytes = Buffer.from(await file.arrayBuffer());
  const [media] = await q(`INSERT INTO media (url, filename, width, height, uploaded_by) VALUES ('', $1, $2, $3, $4) RETURNING id`,
    [`${name}.${ext}`, Number(form.get('width')) || null, Number(form.get('height')) || null, user.id]);
  const url = `/media/${media.id}.${ext}`;
  await q('INSERT INTO media_files (media_id, content_type, bytes) VALUES ($1, $2, $3)', [media.id, file.type, bytes]);
  await q('UPDATE media SET url = $1 WHERE id = $2', [url, media.id]);
  return Response.json({ id: media.id, url, filename: `${name}.${ext}` });
}
