// Serves photos that were uploaded through the admin panel (they are stored in the database).
import { q } from '@/lib/db';

export async function GET(_request, { params }) {
  const { id } = await params;
  const mediaId = Number(String(id).split('.')[0]);
  if (!Number.isInteger(mediaId)) return new Response('Not found', { status: 404 });
  const [file] = await q('SELECT content_type, bytes FROM media_files WHERE media_id = $1', [mediaId]);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(file.bytes, { headers: { 'content-type': file.content_type, 'cache-control': 'public, max-age=31536000, immutable' } });
}
