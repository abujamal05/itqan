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
 *   - the still fallback is a first-class rendering, not a degraded one
 *
 * LOCKED SCOPE (itqan-brand §6): Hud never appears beside a trust-critical
 * moment — no verdicts, scores, real matches, data tables, or the confirmation
 * screen. He belongs to onboarding, the pipeline wait, empty states, errors and
 * genuine milestones. Adding him to a results surface breaks the product's
 * whole argument, so do not.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * WebKit decodes WebM and throws the alpha channel away, so every transparent
 * pixel around Hud paints solid black — a black rectangle where the bird should
 * be. That is every browser on iPhone and iPad (all WebKit underneath) plus
 * Safari on the Mac.
 *
 * Every WebKit browser reports Apple as the vendor, on every platform, and
 * nothing else does: Chrome and Edge say "Google Inc.", Firefox says "". That
 * catches Chrome and Firefox on iOS too, which are WebKit in a different coat
 * and are exactly what a user-agent regex lets through.
 *
 * These browsers never request the clip at all. That matters as much as the
 * rendering: the files are 220-470KB and spending that on a phone to discover
 * the result is unusable is the worst of both. The real fix is shipping an
 * HEVC-with-alpha companion file, which needs the source animations re-exported.
 */
function isWebKit() {
  return typeof navigator !== 'undefined' && navigator.vendor === 'Apple Computer, Inc.';
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * True when the painted frame still has transparent corners. The artwork is
 * centred in a 400x386 frame so all four corners are empty; if they read back
 * opaque, the alpha channel was dropped on the way in and the still is the
 * better answer. Never throws — a probe that fails is not evidence of anything.
 */
function keptAlpha(video: HTMLVideoElement) {
  try {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return true;
    ctx.drawImage(video, 0, 0, 8, 8);
    const { data } = ctx.getImageData(0, 0, 8, 8);
    const corners = [0, 7, 56, 63].map((px) => data[px * 4 + 3]);
    return Math.min(...corners) < 250;
  } catch {
    return true;
  }
}

export type Pose = 'flying-in' | 'idle' | 'waving' | 'thinking' | 'analyzing' | 'celebrating' | 'error';

/**
 * Fluid, not fixed. A single px width made him oversized on a 360px phone and
 * undersized on a 27in monitor, and the still fallback shows it worst because a
 * frozen figure is looked at rather than glanced at. Each size is a range: a
 * floor that keeps him above the 120px where he becomes noise, a viewport term
 * so he tracks the layout, and a ceiling so he never dominates. The container's
 * `aspect-ratio` holds his proportions at every step of that range.
 */
const WIDTHS = {
  sm: 'clamp(120px, 16vw, 140px)',
  md: 'clamp(140px, 22vw, 180px)',
  lg: 'clamp(160px, 30vw, 250px)',
} as const;

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
  /**
   * Decided once on mount so the markup does not flip after paint, then allowed
   * to turn ON later if playback turns out not to work. It never turns back:
   * having seen the animation fail once, retrying it on every pose change would
   * flicker between a black box and a still.
   */
  const [stillOnly, setStillOnly] = useState(() => isWebKit() || prefersReducedMotion());
  const fallBack = useCallback(() => setStillOnly(true), []);

  const src = `/mascot/${pose}.webm`;
  const poster = `/mascot/${pose}.png`;
  const nextSrc = nextPose ? `/mascot/${nextPose}.webm` : null;

  useEffect(() => {
    const video = ref.current;
    if (!video || stillOnly) return;

    const load = () => {
      if (video.src) return;
      video.src = src;
      // Buffer the clip. With preload="none" a looping video can stall at the
      // wrap point while it re-reads the start, which reads as a pause before
      // the animation restarts.
      video.preload = 'auto';
    };
    if (eager) load();

    /**
     * Once playback reports it has started: has the clock actually moved, and
     * did the frame keep its alpha. Low Power Mode on iOS, a data saver, or a
     * refused autoplay all leave a video that loaded fine and simply never
     * moves, and play() resolving is not evidence that it did.
     *
     * Finding it PAUSED at the end of the window is not a failure — that is the
     * observer below doing its job because the user scrolled him out of view.
     * Falling back on that would take the animation away from anyone who
     * scrolls quickly, so the check re-arms for the next time he plays.
     */
    let verified = false;
    let timer = 0;
    const verify = () => {
      if (verified) return;
      verified = true;
      const at = video.currentTime;
      timer = window.setTimeout(() => {
        if (!video.isConnected) return;
        if (video.paused) { verified = false; return; }
        if (video.currentTime === at || !keptAlpha(video)) fallBack();
      }, 600);
    };

    const onEnded = () => {
      if (!nextSrc) return;
      video.src = nextSrc;
      video.loop = true;
      void video.play().catch(fallBack);
    };

    video.addEventListener('playing', verify);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', fallBack);

    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('playing', verify);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', fallBack);
    };

    if (!('IntersectionObserver' in window)) {
      load();
      void video.play().catch(fallBack);
      return cleanup;
    }

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { load(); void video.play().catch(fallBack); }
        else video.pause();
      }),
      { rootMargin: '120px' },
    );
    io.observe(video);

    return () => { io.disconnect(); cleanup(); };
    // Re-runs when the pose changes so a new clip is loaded and played.
  }, [src, nextSrc, eager, stillOnly, fallBack]);

  const box = { ['--hud-width' as string]: WIDTHS[size] };

  if (stillOnly) {
    return (
      <div className="hud" style={box} aria-hidden="true">
        <img
          className="hud__poster"
          src={poster}
          alt=""
          width={400}
          height={386}
          decoding="async"
          loading={eager ? 'eager' : 'lazy'}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className="hud" style={box} aria-hidden="true">
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
        width={400}
        height={386}
      />
    </div>
  );
}
