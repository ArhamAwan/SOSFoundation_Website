// Documents (report PDFs, campaign materials) kept in the database, in parts of up to 4 MB.
// The browser sends a file in parts, so no single request or database row is too big for shared hosting.
import { q } from './db';

export const PART_BYTES = 3 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const FILE_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

export const fileName = (name, type) => {
  const base = String(name || 'document').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9 _-]+/g, ' ').trim().replace(/\s+/g, '-').slice(0, 80) || 'document';
  return `${base}.${FILE_TYPES[type] || 'pdf'}`;
};

/** The public address of a stored file. */
export const fileUrl = (f) => (f ? `/files/${f.id}/${encodeURIComponent(f.filename)}` : '');

export async function filesById(ids) {
  const list = [...new Set(ids.map(Number).filter(Boolean))];
  if (!list.length) return new Map();
  const rows = await q('SELECT id, filename, content_type, size FROM files WHERE complete AND id = ANY($1)', [list]);
  return new Map(rows.map((r) => [r.id, r]));
}

export async function deleteFile(id) {
  if (Number(id)) await q('DELETE FROM files WHERE id = $1', [Number(id)]);
}
