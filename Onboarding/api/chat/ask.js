/**
 * A chat turn.
 *
 * There is no database here, so the thread is not stored. Each turn answers
 * with its junction and a thread id derived from the request, which is enough
 * for the screen to work in a live demo and is honest about what it is: the
 * spine survives in the browser for as long as the tab is open and no longer.
 *
 * `listThreads` therefore answers with an empty list rather than pretending to
 * have history. See BACKEND.md §1.4 — a real implementation stores threads
 * against the account, which is also what makes them reachable from a second
 * device.
 */
import { COOKIE, LOCALE_COOKIE, json, parseBody, readCookies, readRaw, verify } from '../_lib/auth.js';
import { chatAnswer } from '../_lib/chat-data.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const cookies = readCookies(req.headers.cookie);
  if (!verify(cookies[COOKIE])) return json(res, 401, { error: 'no_session' });

  const locale = cookies[LOCALE_COOKIE] === 'en' ? 'en' : 'ar';
  const sent = parseBody(await readRaw(req), req.headers['content-type'] ?? '');
  const question = String(sent.question ?? '').trim();
  if (!question) return json(res, 400, { error: 'empty_question' });

  const junction = { ...chatAnswer(locale, question), id: `j${Date.now().toString(36)}` };
  const threadId = String(sent.threadId ?? '') || `t${Date.now().toString(36)}`;

  return json(res, 200, { threadId, junction });
}
