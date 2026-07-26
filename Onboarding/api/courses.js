import { COOKIE, LOCALE_COOKIE, json, readCookies, verify } from './_lib/auth.js';
import { courses } from './_lib/data.js';

export default async function handler(req, res) {
  const cookies = readCookies(req.headers.cookie);
  if (!verify(cookies[COOKIE])) return json(res, 401, { error: 'no_session' });
  return json(res, 200, courses(cookies[LOCALE_COOKIE] === 'en' ? 'en' : 'ar'));
}
