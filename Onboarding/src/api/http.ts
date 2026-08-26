/**
 * The API client. One thin fetch wrapper; no logic lives here, because
 * extraction, ranking and matching all belong to the agent services.
 *
 * Auth is NOT implemented here. The marketing site owns log in and sign up:
 * its forms post to /api/placeholder/{login,signup} and the response sets a
 * session cookie on this origin. This app only ever *reads* that session
 * through /api/session, and ends it through /api/logout. There is deliberately
 * no login() or signup() method — having one would invite a second, competing
 * sign-in surface, which is the thing we are avoiding.
 *
 * `credentials: 'same-origin'` is what carries the cookie.
 */
import type {
  AnalysisJob, ChatMessage, ChatThread, ChatThreadSummary, ConfirmProfileResult,
  ConfirmedProfile, Course, DashboardData, Feedback, FeedbackState, ItqanApi,
  JobMatch, JobsResult, OnboardingProgress, Session, StoredProfile, UploadedDocument,
  Usage,
} from './types';
import { emptyFeedback } from './types';
import { takeHandoffToken } from '../lib/site';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

export class HttpError extends Error {
  status: number;
  /**
   * The server's own name for what went wrong — `last_cv`, `email_taken`,
   * `token_limit`. An ID, never a sentence.
   *
   * It carries the code rather than a message because this product is
   * bilingual: an English string on the wire cannot be shown to an Arabic user,
   * so the API sends an identifier and the front end owns the wording in both
   * languages. That contract was already being honoured on the server — and
   * BROKEN HERE, because this client read the status and threw the body away,
   * which left every specific refusal the API can make unreachable and every
   * failure rendering as one generic sentence.
   *
   * Undefined when the response carried no code (a proxy's HTML 502, a network
   * failure), which callers must handle: the generic message is still the right
   * answer when nothing more specific is known.
   */
  code?: string;
  /**
   * Everything else the failed response carried.
   *
   * The server publishes numbers alongside a refusal precisely so the interface
   * can be specific: a `token_limit` names what the action `needed`, what is
   * `remaining`, and when it `resetsAt`. Keeping only `code` threw all of that
   * away and left the screen saying "that did not work" over a body that could
   * have said "a re-read costs 19 and you have 8 left until tomorrow".
   *
   * `{}` when the body was not JSON, so a caller can read a field without
   * checking for the object first.
   */
  details: Record<string, unknown>;
  constructor(status: number, message: string, body?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.details = body ?? {};
    const code = body?.error;
    this.code = typeof code === 'string' ? code : undefined;
  }
}

/** The parsed body of a failed response, or undefined. Never throws: a body that
 *  is not JSON is a normal failure mode here (a gateway error page), and it must
 *  not turn a handled rejection into an unhandled one. */
async function errorBody(res: Response): Promise<Record<string, unknown> | undefined> {
  try {
    const body: unknown = await res.clone().json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

/** The same, for the XHR upload paths, which hold a body string rather than a
 *  `Response`. They are where `file_too_large` and `empty_file` arrive, so
 *  dropping the code here would leave the two most explainable upload failures
 *  rendering as "something went wrong". */
function errorBodyFrom(text: string): Record<string, unknown> | undefined {
  try {
    const body: unknown = JSON.parse(text);
    return body && typeof body === 'object' ? body as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: init.body instanceof FormData
      ? init.headers
      : { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) {
    throw new HttpError(res.status, `${res.status} on ${path}`, await errorBody(res));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function createHttpApi(): ItqanApi {
  return {
    /**
     * Reads the session the site established. Null means "not signed in".
     *
     * On the first load after signing in on the site, the URL carries a
     * short-lived handoff token; it is passed here so the exchange and the
     * "who am I" both happen in one request, leaving no window where the app
     * is loaded but not yet authenticated.
     */
    async session() {
      const handoff = takeHandoffToken();
      try {
        return await req<Session>(handoff ? `/session?t=${encodeURIComponent(handoff)}` : '/session');
      } catch {
        return null;
      }
    },
    async logout() {
      await req<void>('/logout', { method: 'POST' }).catch(() => {});
    },

    saveProgress(p, signal) {
      return req<void>('/onboarding/progress', { method: 'PUT', body: JSON.stringify(p), signal });
    },
    getProgress(signal) {
      return req<OnboardingProgress | null>('/onboarding/progress', { signal }).catch(() => null);
    },
    async clearProgress() {
      await req<void>('/onboarding/progress', { method: 'DELETE' }).catch(() => {});
    },

    /**
     * XHR rather than fetch: fetch still cannot report upload progress in any
     * browser, and this is the one request where the user watches a bar.
     */
    uploadDocument({ file, kind, onProgress }, signal) {
      return new Promise<UploadedDocument>((resolve, reject) => {
        const form = new FormData();
        form.append('file', file);
        form.append('kind', kind);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE}/documents`);
        xhr.withCredentials = true;
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress?.(e.loaded / e.total);
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText) as UploadedDocument); }
            catch { reject(new HttpError(xhr.status, 'bad json')); }
          } else reject(new HttpError(xhr.status, 'upload failed', errorBodyFrom(xhr.responseText)));
        });
        xhr.addEventListener('error', () => reject(new HttpError(0, 'network')));
        xhr.addEventListener('abort', () => reject(new HttpError(0, 'aborted')));
        signal?.addEventListener('abort', () => xhr.abort());
        xhr.send(form);
      });
    },
    /**
     * The same XHR shape as `uploadDocument`, for the same reason: a document
     * scan on a phone connection is not instant, and a row that says only
     * "replacing" for twenty seconds is indistinguishable from a stalled one.
     */
    replaceDocument({ id, file, onProgress }, signal) {
      return new Promise<UploadedDocument>((resolve, reject) => {
        const form = new FormData();
        form.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('PUT', `${BASE}/documents/${encodeURIComponent(id)}`);
        xhr.withCredentials = true;
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress?.(e.loaded / e.total);
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText) as UploadedDocument); }
            catch { reject(new HttpError(xhr.status, 'bad json')); }
          } else reject(new HttpError(xhr.status, 'replace failed', errorBodyFrom(xhr.responseText)));
        });
        xhr.addEventListener('error', () => reject(new HttpError(0, 'network')));
        xhr.addEventListener('abort', () => reject(new HttpError(0, 'aborted')));
        signal?.addEventListener('abort', () => xhr.abort());
        xhr.send(form);
      });
    },
    updateDocumentKind(id, kind, signal) {
      return req<UploadedDocument>(`/documents/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ kind }),
        signal,
      });
    },
    startAnalysis(documentIds, signal) {
      return req<{ jobId: string }>('/analysis', {
        method: 'POST', body: JSON.stringify({ documentIds }), signal,
      });
    },
    getAnalysis(jobId, signal) {
      return req<AnalysisJob>(`/analysis/${encodeURIComponent(jobId)}`, { signal });
    },
    confirmProfile(profile: ConfirmedProfile, signal) {
      return req<ConfirmProfileResult>('/profile', { method: 'POST', body: JSON.stringify(profile), signal });
    },
    getProfile(signal) {
      // A missing profile is a normal answer (nothing confirmed yet), not an
      // error the screen should render as a failure.
      return req<StoredProfile | null>('/profile', { signal }).catch(() => null);
    },
    updateProfile(profile: ConfirmedProfile, signal) {
      return req<{ ok: true }>('/profile', { method: 'PUT', body: JSON.stringify(profile), signal });
    },

    /**
     * XHR for the same reason uploadDocument uses it: fetch still cannot report
     * upload progress, and a photo on a phone connection is not instant.
     * See the contract note in types.ts — this endpoint is not built yet.
     */
    uploadAvatar({ file, onProgress }, signal) {
      return new Promise<{ avatarUrl: string }>((resolve, reject) => {
        const form = new FormData();
        form.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE}/profile/avatar`);
        xhr.withCredentials = true;
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress?.(e.loaded / e.total);
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText) as { avatarUrl: string }); }
            catch { reject(new HttpError(xhr.status, 'bad json')); }
          } else reject(new HttpError(xhr.status, 'avatar upload failed', errorBodyFrom(xhr.responseText)));
        });
        xhr.addEventListener('error', () => reject(new HttpError(0, 'network')));
        xhr.addEventListener('abort', () => reject(new HttpError(0, 'aborted')));
        signal?.addEventListener('abort', () => xhr.abort());
        xhr.send(form);
      });
    },
    async removeAvatar(signal) {
      await req<void>('/profile/avatar', { method: 'DELETE', signal });
    },
    getDashboard(signal) { return req<DashboardData>('/dashboard', { signal }); },
    /**
     * Jobs, accepting BOTH shapes on purpose.
     *
     * The gated shape is `{ matches, locked, plan }` (BACKEND.md §5) and the
     * server does not send it yet — it still returns a bare array. Typing the
     * client to the new shape alone made `data.matches` undefined against every
     * environment that had not shipped the cut, which emptied the job list
     * completely: the page said "no job postings" to people who had four.
     *
     * So an array is read as "everything, nothing withheld". The lock appears
     * on its own the day the server starts sending a count, and until then
     * nothing anywhere has to change or be remembered.
     */
    async getJobs(signal) {
      const raw = await req<JobsResult | JobMatch[]>('/jobs', { signal });
      if (Array.isArray(raw)) return { matches: raw, locked: 0, plan: 'free' as const };
      return { ...raw, matches: raw.matches ?? [], locked: raw.locked ?? 0 };
    },
    getCourses(signal) { return req<Course[]>('/courses', { signal }); },
    completeCourse(courseId, signal) {
      return req<void>(`/courses/${encodeURIComponent(courseId)}/complete`, { method: 'POST', signal });
    },
    uncompleteCourse(courseId, signal) {
      return req<void>(`/courses/${encodeURIComponent(courseId)}/complete`, { method: 'DELETE', signal });
    },
    getUsage(signal) { return req<Usage>('/usage', { signal }); },

    rerunMatching(signal) {
      // `confirm: true` is required by the server and is sent only from the
      // confirm step — it is not a formality: at one re-run a week, a credit
      // spent by accident is the user's entire allowance gone.
      /* `mode: 'full'` — re-READ the documents, not just re-match.
         The server then stops at `awaiting_confirmation` and the person checks
         their details before anything is matched, which is the whole point of
         re-running after uploading a corrected CV. Without this it silently got
         `match`, which re-ranked against the same extraction and looked like
         nothing had happened. */
      return req<{ jobId: string; awaitingConfirmation?: boolean }>('/assistant/rerun', {
        method: 'POST',
        body: JSON.stringify({ confirm: true, mode: 'full' }),
        signal,
      });
    },
    async deleteDocument(id, signal) {
      await req<void>(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE', signal });
    },
    async deactivateAccount(signal) {
      await req<void>('/account/deactivate', { method: 'POST', signal });
    },
    async deleteAccount(signal) {
      await req<void>('/account', { method: 'DELETE', signal });
    },
    startCancellation(signal) {
      return req<{ url: string }>('/subscription/cancel', { method: 'POST', signal });
    },
    listThreads(signal) {
      // No threads yet is a normal state on a new account, not a failure.
      return req<ChatThreadSummary[]>('/chat/threads', { signal }).catch(() => []);
    },
    getThread(id, signal) {
      return req<ChatThread>(`/chat/threads/${encodeURIComponent(id)}`, { signal });
    },
    ask({ threadId, question, files }, signal) {
      /* Multipart only when there is actually a file, so the common case stays
         a plain JSON post and the server is not made to parse a form for
         nothing. `req` already leaves FormData's Content-Type to the browser,
         which has to set the boundary itself. */
      if (files?.length) {
        const form = new FormData();
        form.append('question', question);
        if (threadId) form.append('threadId', threadId);
        files.forEach((f) => form.append('files', f, f.name));
        return req<{ threadId: string; message: ChatMessage }>('/chat/ask', {
          method: 'POST',
          body: form,
          signal,
        });
      }
      return req<{ threadId: string; message: ChatMessage }>('/chat/ask', {
        method: 'POST',
        body: JSON.stringify({ threadId, question }),
        signal,
      });
    },
    async rateMessage({ threadId, messageId, verdict }, signal) {
      // Swallowed on purpose: a rating that fails to send is not worth an error
      // in front of someone who was only being helpful.
      await req<void>('/chat/rate', {
        method: 'POST',
        body: JSON.stringify({ threadId, messageId, verdict }),
        signal,
      }).catch(() => {});
    },

    async sendFeedback(input: Feedback, signal) {
      // Swallowed for the same reason rateMessage is, and see the note on the
      // interface: the card has already changed state in front of the user.
      await req<void>('/preferences/feedback', {
        method: 'POST', body: JSON.stringify(input), signal,
      }).catch(() => {});
    },
    getFeedback(signal) {
      // No opinions yet is the normal state of a new account, not a failure.
      return req<FeedbackState>('/preferences/feedback', { signal })
        .catch(() => emptyFeedback());
    },
    findSimilarCourse({ courseId, exclude }, signal) {
      return req<Course | null>('/courses/similar', {
        method: 'POST', body: JSON.stringify({ courseId, exclude }), signal,
      // Null is a real answer here ("nothing else closes this gap"), and so is a
      // failed lookup. The screen says the same thing for both, because to the
      // user they are the same thing: no replacement arrived.
      }).catch(() => null);
    },
  };
}
