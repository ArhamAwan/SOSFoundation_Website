// Serves documents uploaded in the admin panel (report PDFs, campaign materials).
import { q } from '@/lib/db';

export async function GET(_request, { params }) {
  const { id } = await params;
  const fileId = Number(id);
  if (!Number.isInteger(fileId)) return new Response('Not found', { status: 404 });
  const [file] = await q('SELECT filename, content_type, size FROM files WHERE id = $1 AND complete', [fileId]);
  if (!file) return new Response('Not found', { status: 404 });
  const parts = await q('SELECT bytes FROM file_parts WHERE file_id = $1 ORDER BY n', [fileId]);
  const body = Buffer.concat(parts.map((p) => Buffer.from(p.bytes)));
  return new Response(body, {
    headers: {
      'content-type': file.content_type, 'content-length': String(body.length),
      'content-disposition': `inline; filename="${file.filename.replace(/"/g, '')}"`,
      'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff',
    },
  });
}
