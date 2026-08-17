/**
 * Thread history.
 *
 * Answers with an empty list, and that is the honest answer for this
 * deployment rather than a stub left unfinished: there is no database behind
 * these handlers, so no thread from a previous visit exists to return. The
 * client treats an empty list as "no history yet", which is exactly true.
 *
 * A real implementation stores threads against the account and returns
 * `{ id, title, updatedAt }` newest first. See BACKEND.md §1.4.
 */
import { COOKIE, json, readCookies, verify } from '../_lib/auth.js';

export default async function handler(req, res) {
  const cookies = readCookies(req.headers.cookie);
  if (!verify(cookies[COOKIE])) return json(res, 401, { error: 'no_session' });
  return json(res, 200, []);
}
