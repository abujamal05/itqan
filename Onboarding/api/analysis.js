/**
 * Starts the pipeline.
 *
 * Serverless functions keep nothing between invocations, so the job cannot be
 * held in memory. Instead the job id IS the state: it carries the start time
 * and whether any document was flagged unreadable, so polling can compute
 * progress from the clock alone. No store, no drift, no cleanup.
 */
import { COOKIE, json, parseBody, readCookies, readRaw, verify } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!verify(readCookies(req.headers.cookie)[COOKIE])) return json(res, 401, { error: 'no_session' });

  const body = parseBody(await readRaw(req), req.headers['content-type']);
  const ids = Array.isArray(body.documentIds) ? body.documentIds : [];
  const bad = ids.some((d) => String(d).endsWith('_u')) ? 'u' : 'o';

  return json(res, 200, { jobId: `job_${Date.now().toString(36)}_${bad}` });
}
