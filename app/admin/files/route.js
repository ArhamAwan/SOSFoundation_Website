// Receives a document from the admin panel in parts: start, then each part, then done.
import { getUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { FILE_TYPES, MAX_FILE_BYTES, PART_BYTES, fileName } from '@/lib/files';

const no = (error, status = 400) => Response.json({ error }, { status });

export async function POST(request) {
  const user = await getUser();
  if (!user) return no('Your session has ended. Sign in again.', 401);
  if (user.leadsOnly) return no('Not allowed.', 403);
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) return no('Not allowed.', 403);
  const url = new URL(request.url);
  const step = url.searchParams.get('step');

  if (step === 'start') {
    const { name, type, size, accept } = await request.json();
    const allowed = accept === 'pdf' ? ['application/pdf'] : Object.keys(FILE_TYPES);
    if (!allowed.includes(type)) return no(accept === 'pdf' ? 'Choose a PDF file.' : 'Choose a PDF, JPG or PNG file.');
    if (!(size > 0) || size > MAX_FILE_BYTES) return no('That file is too large (25 MB at most).');
    const [row] = await q('INSERT INTO files (filename, content_type, size, parts, uploaded_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [fileName(name, type), type, size, Math.ceil(size / PART_BYTES), user.id]);
    return Response.json({ id: row.id, partBytes: PART_BYTES });
  }

  const id = Number(url.searchParams.get('id')) || 0;
  const [file] = await q('SELECT id, size, parts, complete, uploaded_by FROM files WHERE id = $1', [id]);
  if (!file || file.complete || file.uploaded_by !== user.id) return no('That upload is no longer open. Choose the file again.');

  if (step === 'part') {
    const n = Number(url.searchParams.get('n'));
    if (!Number.isInteger(n) || n < 0 || n >= file.parts) return no('Unexpected part.');
    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.length || bytes.length > PART_BYTES) return no('Unexpected part size.');
    await q('DELETE FROM file_parts WHERE file_id = $1 AND n = $2', [id, n]);
    await q('INSERT INTO file_parts (file_id, n, bytes) VALUES ($1, $2, $3)', [id, n, bytes]);
    return Response.json({ ok: true });
  }

  if (step === 'done') {
    const rows = await q('SELECT n, length(bytes) AS len FROM file_parts WHERE file_id = $1', [id]);
    const total = rows.reduce((t, r) => t + Number(r.len), 0);
    if (rows.length !== file.parts || total !== Number(file.size)) return no('The upload did not finish. Choose the file again.');
    // A PDF starts with %PDF; check it so a renamed file of another kind is not offered as a PDF.
    const [first] = await q('SELECT bytes FROM file_parts WHERE file_id = $1 AND n = 0', [id]);
    const head = Buffer.from(first.bytes).subarray(0, 8);
    const [meta] = await q('SELECT content_type, filename FROM files WHERE id = $1', [id]);
    const okHead = meta.content_type === 'application/pdf' ? head.toString('latin1').startsWith('%PDF')
      : meta.content_type === 'image/png' ? head[0] === 0x89 && head[1] === 0x50 : head[0] === 0xff && head[1] === 0xd8;
    if (!okHead) { await q('DELETE FROM files WHERE id = $1', [id]); return no('That file is not a real ' + (meta.content_type === 'application/pdf' ? 'PDF.' : 'image.')); }
    await q('UPDATE files SET complete = TRUE WHERE id = $1', [id]);
    return Response.json({ id, filename: meta.filename, size: Number(file.size) });
  }
  return no('Unknown step.');
}
