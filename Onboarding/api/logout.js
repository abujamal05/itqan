/** Ends the session on this domain. The site's own cookie expires on its own. */
import { clearSessionCookie, json } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  return json(res, 200, { ok: true }, [clearSessionCookie()]);
}
