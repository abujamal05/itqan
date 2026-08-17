/**
 * Walking a direction out of a junction.
 *
 * Stateless here, like ask.js: the junction walked to is computed and returned,
 * and the client already holds the spine it belongs to. A stored implementation
 * additionally records `takenForkId` on the junction it came from — and records
 * it rather than removing the other forks, because the directions not taken
 * staying re-enterable is the whole argument of the screen.
 */
import { COOKIE, LOCALE_COOKIE, json, parseBody, readCookies, readRaw, verify } from '../_lib/auth.js';
import { chatFork } from '../_lib/chat-data.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const cookies = readCookies(req.headers.cookie);
  if (!verify(cookies[COOKIE])) return json(res, 401, { error: 'no_session' });

  const locale = cookies[LOCALE_COOKIE] === 'en' ? 'en' : 'ar';
  const sent = parseBody(await readRaw(req), req.headers['content-type'] ?? '');
  const forkId = String(sent.forkId ?? '');
  if (!forkId) return json(res, 400, { error: 'no_fork' });

  const junction = {
    ...chatFork(locale, forkId),
    id: `j${Date.now().toString(36)}`,
    parentId: String(sent.junctionId ?? '') || null,
  };

  const threadId = String(sent.threadId ?? '') || `t${Date.now().toString(36)}`;
  return json(res, 200, { threadId, junction });
}
