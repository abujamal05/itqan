/**
 * The confirmed profile — the end of onboarding.
 *
 * There is no database, so "this account has finished onboarding" cannot be
 * written to a row. It is re-issued as a NEW session cookie with the flag
 * flipped, which is stateless, survives a reload, and keeps the guards honest
 * without inventing storage that is not there.
 */
import { COOKIE, json, readCookies, readRaw, sessionCookie, sign, verify } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const session = verify(readCookies(req.headers.cookie)[COOKIE]);
  if (!session) return json(res, 401, { error: 'no_session' });

  await readRaw(req);   // the profile itself has nowhere to go without a store

  const token = sign({
    id: session.id,
    fullName: session.fullName,
    email: session.email,
    onboarded: true,
  });

  // Clearing progress alongside stops the resume banner reappearing after the
  // flow is already finished.
  return json(res, 200, { ok: true }, [
    sessionCookie(token),
    'itqan_progress=; Path=/; Max-Age=0; Secure; SameSite=Lax',
  ]);
}
