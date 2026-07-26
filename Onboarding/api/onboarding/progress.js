/**
 * Resumable onboarding, without a database.
 *
 * Progress lives in a cookie on this domain. It is small by nature — a few
 * document records, some interest ids and a short note — and keeping it here
 * means an interrupted signup survives a reload or a closed tab, which is the
 * whole point of the feature.
 *
 * The honest limitation: a cookie is per browser, so this does NOT carry
 * across devices the way a stored row would. If it ever exceeds the 4KB
 * cookie limit the save is skipped rather than half written.
 */
import { COOKIE, json, readCookies, readRaw, verify } from '../_lib/auth.js';

const KEY = 'itqan_progress';
const MAX_BYTES = 3500;   // leave headroom under the 4KB cookie limit

export default async function handler(req, res) {
  const cookies = readCookies(req.headers.cookie);
  if (!verify(cookies[COOKIE])) return json(res, 401, { error: 'no_session' });

  if (req.method === 'PUT') {
    const raw = (await readRaw(req)).toString('utf8');
    if (Buffer.byteLength(raw) > MAX_BYTES) return json(res, 200, { ok: true, stored: false });
    const value = encodeURIComponent(raw);
    return json(res, 200, { ok: true, stored: true }, [
      `${KEY}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 7}; Secure; SameSite=Lax`,
    ]);
  }

  if (req.method === 'DELETE') {
    return json(res, 200, { ok: true }, [`${KEY}=; Path=/; Max-Age=0; Secure; SameSite=Lax`]);
  }

  const stored = cookies[KEY];
  if (!stored) return json(res, 200, null);
  try { return json(res, 200, JSON.parse(stored)); } catch { return json(res, 200, null); }
}
