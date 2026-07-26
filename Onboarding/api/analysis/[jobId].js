/**
 * Polls the pipeline. Progress is derived from the timestamp inside the job
 * id, so this stays correct across cold starts and different instances.
 */
import { COOKIE, LOCALE_COOKIE, json, readCookies, verify } from '../_lib/auth.js';
import { analysisResult } from '../_lib/data.js';

const PIPELINE_MS = 7000;

export default async function handler(req, res) {
  const cookies = readCookies(req.headers.cookie);
  if (!verify(cookies[COOKIE])) return json(res, 401, { error: 'no_session' });

  const jobId = String(req.query?.jobId || '');
  const [, stamp, flag] = jobId.split('_');
  const started = parseInt(stamp || '', 36);
  if (!started || Number.isNaN(started)) return json(res, 404, { error: 'no_job' });

  if (flag === 'u') {
    return json(res, 200, { jobId, stage: 'failed', progress: 0, error: 'unreadable' });
  }

  const p = Math.min(1, (Date.now() - started) / PIPELINE_MS);
  const stage = p >= 1 ? 'done' : p > 0.66 ? 'matching' : p > 0.33 ? 'translating' : 'reading';
  const locale = cookies[LOCALE_COOKIE] === 'en' ? 'en' : 'ar';

  return json(res, 200, {
    jobId, stage, progress: p,
    result: stage === 'done' ? analysisResult(locale) : undefined,
  });
}
