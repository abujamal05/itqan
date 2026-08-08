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
  AnalysisJob, ConfirmProfileResult, ConfirmedProfile, Course, DashboardData, ItqanApi,
  JobMatch, OnboardingProgress, Session, StoredProfile, UploadedDocument,
} from './types';
import { takeHandoffToken } from '../lib/site';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
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
  if (!res.ok) throw new HttpError(res.status, `${res.status} on ${path}`);
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
          } else reject(new HttpError(xhr.status, 'upload failed'));
        });
        xhr.addEventListener('error', () => reject(new HttpError(0, 'network')));
        xhr.addEventListener('abort', () => reject(new HttpError(0, 'aborted')));
        signal?.addEventListener('abort', () => xhr.abort());
        xhr.send(form);
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
          } else reject(new HttpError(xhr.status, 'avatar upload failed'));
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
    getJobs(signal) { return req<JobMatch[]>('/jobs', { signal }); },
    getCourses(signal) { return req<Course[]>('/courses', { signal }); },
  };
}
