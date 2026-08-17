/**
 * Hud's chat, as ONE serverless function rather than three.
 *
 * This started as api/chat/ask.js, api/chat/fork.js and api/chat/threads.js,
 * which read better and deployed worse: Vercel counts every file under api/ as
 * its own Serverless Function, the Hobby plan allows 12 per deployment, and this
 * project was already at 10. Three more made 13 and the app-itqan build started
 * failing while itqan-site kept passing — a failure with no compile error in it,
 * which is why it survived a green `tsc`, a green `vite build` and a green
 * Playwright run before anyone saw it.
 *
 * A catch-all keeps the URLs exactly as BACKEND.md §1.4 specifies them, so
 * nothing on the client changes. If more endpoints are ever needed here, they
 * belong in this switch rather than in new files.
 *
 * Stateless, like the rest of these handlers: there is no database behind them,
 * so a thread is not stored and history is honestly empty. See BACKEND.md.
 */
import { COOKIE, LOCALE_COOKIE, json, parseBody, readCookies, readRaw, verify } from '../_lib/auth.js';
import { chatAnswer, chatFork } from '../_lib/chat-data.js';

/**
 * The segment after /api/chat/.
 *
 * `req.query.path` is what the dynamic route provides, but it is read through a
 * fallback rather than trusted alone: the shape differs between runtimes (string
 * vs array) and a mis-read here would answer every route as a 404, which is a
 * confusing way to fail. The URL is the one source always present.
 */
function route(req) {
  const fromQuery = req.query?.path;
  if (Array.isArray(fromQuery) && fromQuery.length) return fromQuery[0];
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery;
  const [pathname] = String(req.url || '').split('?');
  const after = pathname.split('/api/chat/')[1] || '';
  return after.split('/')[0];
}

export default async function handler(req, res) {
  const cookies = readCookies(req.headers.cookie);
  if (!verify(cookies[COOKIE])) return json(res, 401, { error: 'no_session' });

  const locale = cookies[LOCALE_COOKIE] === 'en' ? 'en' : 'ar';
  const which = route(req);

  /* Thread history. An empty list is the honest answer here rather than a stub
     left unfinished: with no store, no thread from a previous visit exists. The
     client renders that as "no history yet", which is exactly true. */
  if (which === 'threads') {
    return json(res, 200, []);
  }

  if (which === 'ask') {
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    const sent = parseBody(await readRaw(req), req.headers['content-type'] ?? '');
    const question = String(sent.question ?? '').trim();
    if (!question) return json(res, 400, { error: 'empty_question' });

    const junction = { ...chatAnswer(locale, question), id: `j${Date.now().toString(36)}` };
    const threadId = String(sent.threadId ?? '') || `t${Date.now().toString(36)}`;
    return json(res, 200, { threadId, junction });
  }

  if (which === 'fork') {
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    const sent = parseBody(await readRaw(req), req.headers['content-type'] ?? '');
    const forkId = String(sent.forkId ?? '');
    if (!forkId) return json(res, 400, { error: 'no_fork' });

    /* A stored implementation would also record `takenForkId` on the junction
       this came from — recording it, never removing the other forks, because the
       directions not taken staying re-enterable is the whole argument of the
       screen. */
    const junction = {
      ...chatFork(locale, forkId),
      id: `j${Date.now().toString(36)}`,
      parentId: String(sent.junctionId ?? '') || null,
    };
    const threadId = String(sent.threadId ?? '') || `t${Date.now().toString(36)}`;
    return json(res, 200, { threadId, junction });
  }

  return json(res, 404, { error: 'no_route' });
}
