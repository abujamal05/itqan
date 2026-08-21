/**
 * A file size a person can read, in their own language.
 *
 * The units were previously a hardcoded `KB` interpolated next to a localised
 * number, so an Arabic screen read a right-to-left sentence with a Latin unit
 * glued to the end of it. Both units are keys now.
 *
 * It rounds up to 1 rather than down to 0: a document that exists is never
 * "0 KB", and a zero there reads as a failed upload rather than a small file.
 */
export function fileSize(
  bytes: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
  formatNumber: (n: number) => string,
): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    /* One decimal place, because "2 MB" and "2.4 MB" are meaningfully
       different at this scale and whole megabytes hide that. */
    return t('file.mb', { n: formatNumber(Math.round((kb / 1024) * 10) / 10) });
  }
  return t('file.kb', { n: formatNumber(Math.max(1, Math.round(kb))) });
}
