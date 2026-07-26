/**
 * Accepts one uploaded document and returns its record.
 *
 * The bytes are discarded: there is no object store wired up, and pretending
 * otherwise would hide that work rather than do it. Everything the flow needs
 * downstream — name, size, kind — is metadata.
 *
 * The "unreadable" test hook is encoded in the returned id, because the
 * analysis endpoint is stateless and has no other way to know this document
 * was meant to fail.
 */
import { COOKIE, json, parseBody, readCookies, readRaw, verify } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!verify(readCookies(req.headers.cookie)[COOKIE])) return json(res, 401, { error: 'no_session' });

  const form = parseBody(await readRaw(req), req.headers['content-type']);
  const fileName = form.__filename || 'document.pdf';
  const bad = /unreadable/i.test(fileName) ? '_u' : '';

  return json(res, 200, {
    id: `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}${bad}`,
    fileName,
    mimeType: form.__mimetype || 'application/pdf',
    sizeBytes: Number(form.__size || 0),
    kind: form.kind || 'other',
  });
}
