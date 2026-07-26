/**
 * Hud, the hoopoe — the animated build, ported from the marketing site's
 * Hud.astro so both products move the same way.
 *
 * Contract kept identical: /mascot/{pose}.webm with /mascot/{pose}.png as the
 * poster. Behaviour kept identical too:
 *   - decoration only: aria-hidden, empty alt, never the sole carrier of meaning
 *   - reduced motion gets the poster and never requests the video
 *   - videos play only while in the viewport and pause outside it
 *   - play-once poses hand over to a follow-up pose (flying-in -> idle)
 *   - never below 120px wide, where he becomes visual noise
 *   - on dark surfaces a hairline cream keyline stops his navy parts merging
 *     into the canvas (in CSS, so one video file serves both themes)
 *
 * LOCKED SCOPE (itqan-brand §6): Hud never appears beside a trust-critical
 * moment — no verdicts, scores, real matches, data tables, or the confirmation
 * screen. He belongs to onboarding, the pipeline wait, empty states, errors and
 * genuine milestones. Adding him to a results surface breaks the product's
 * whole argument, so do not.
 */
import { useEffect, useRef } from 'react';

export type Pose = 'flying-in' | 'idle' | 'waving' | 'thinking' | 'analyzing' | 'celebrating' | 'error';

const WIDTHS = { sm: 120, md: 180, lg: 250 } as const;

export function Hud({
  pose,
  then: nextPose,
  size = 'md',
  loop = false,
  eager = false,
}: {
  pose: Pose;
  /** Pose to hand over to once a play-once pose finishes. */
  then?: Pose;
  size?: keyof typeof WIDTHS;
  loop?: boolean;
  eager?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const src = `/mascot/${pose}.webm`;
  const poster = `/mascot/${pose}.png`;
  const nextSrc = nextPose ? `/mascot/${nextPose}.webm` : null;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.removeAttribute('autoplay');
      video.preload = 'none';
      return;                       // poster only; the video is never fetched
    }

    const load = () => { if (!video.src) video.src = src; };
    if (eager) load();

    const onEnded = () => {
      if (!nextSrc) return;
      video.src = nextSrc;
      video.loop = true;
      void video.play().catch(() => {});
    };
    video.addEventListener('ended', onEnded);

    if (!('IntersectionObserver' in window)) {
      load();
      void video.play().catch(() => {});
      return () => video.removeEventListener('ended', onEnded);
    }

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { load(); void video.play().catch(() => {}); }
        else video.pause();
      }),
      { rootMargin: '120px' },
    );
    io.observe(video);

    return () => {
      io.disconnect();
      video.removeEventListener('ended', onEnded);
    };
    // Re-runs when the pose changes so a new clip is loaded and played.
  }, [src, nextSrc, eager]);

  return (
    <div className="hud" style={{ ['--hud-width' as string]: `${WIDTHS[size]}px` }} aria-hidden="true">
      <video
        ref={ref}
        key={src}
        className="hud__video"
        muted
        playsInline
        autoPlay
        loop={loop}
        poster={poster}
        preload="none"
      />
    </div>
  );
}
