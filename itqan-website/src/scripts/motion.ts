/**
 * Site motion: the entrance, the scroll reveals, and the feel of scrolling.
 *
 * Three jobs in one module because they have to agree: reveals must not start
 * until the entrance has finished, and both need to know whether Lenis is
 * driving the scroll position.
 *
 * WHY `motion/mini` AND NOT `motion`.
 * The full entry point costs 28KB gzipped on a site whose entire JS budget was
 * 2.8KB. `motion/mini` is the same `animate()` on top of the Web Animations
 * API, which the browser already ships, for a fraction of that. The two things
 * the full build would have added here — `stagger` and `inView` — are four
 * lines and an IntersectionObserver respectively, so they are written out
 * below rather than imported at 10x their weight.
 *
 * WHAT THIS DOES NOT REPLACE: the `.reveal` / `.is-visible` class contract.
 * Four separate CSS effects hang off it — the page-head rule wiping in, the
 * gold marker sweeping under a phrase, the survey meters filling, and every
 * `pathLength` stroke drawing itself. Driving those from JS instead would have
 * silently killed all four. So this toggles the same class the CSS already
 * listens for, and only the ENTRANCE is animated directly.
 *
 * NO-JS AND FAILURE ARE SAFE. Everything is visible by default in CSS; the
 * `motion-ready` and `reveal-ready` classes are what ENABLE the hidden start
 * states, and they are only ever set from here. If this bundle fails to parse
 * the page renders complete and static rather than blank, which is also why a
 * motion change cannot break the e2e suite's visibility assertions.
 */
import { animate } from 'motion/mini';
import Lenis from 'lenis';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

/* Itqan's own curve, from tokens.css, so a JS-driven move and a CSS-driven one
   settle identically instead of almost-identically. */
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];

/* ---------------------------------------------------------------- SCROLL ---
   Momentum, not snap. The page keeps its weight when you let go instead of
   stopping dead, which is the whole difference between reading a document and
   moving through a place.

   OFF under reduced motion. Smoothing IS movement the user did not ask for,
   and it is the most nauseating thing on a page for anyone who set that
   preference. Native scrolling is the correct answer there, not a gentler
   interpolation.

   Touch stays native too: phone scrolling is already momentum-based, and
   hijacking it makes a page feel laggy rather than heavy. */
const startScroll = () => {
  if (reduced) return;

  const lenis = new Lenis({
    duration: 1.15,
    /* Exponential ease-out. The long tail is what reads as weight; a linear or
       quadratic settle just reads as lag. */
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
  });

  const raf = (time: number) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  /* In-page anchors have to go through Lenis or they fight it: the browser
     jumps, Lenis interpolates back, and the page visibly moves twice. The skip
     link is the one that matters most, being the keyboard entry point. */
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (event) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector<HTMLElement>(id);
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: -24 });
      /* Focus still has to move, or the skip link skips visually and leaves the
         keyboard exactly where it was. */
      target.focus({ preventScroll: true });
    });
  });
};

/* -------------------------------------------------------------- ENTRANCE ---
   One orchestrated arrival rather than a dozen elements each doing their own
   thing. The order is the reading order: the chrome settles first so the page
   has a frame, then the headline, then everything beneath it. The mascot is
   last because he is the flourish, and a flourish that arrives first is just a
   distraction.

   `data-enter` marks participants; anything unmarked simply renders, which
   keeps the markup honest about what moves. */
const runEntrance = async () => {
  const items = [...document.querySelectorAll<HTMLElement>('[data-enter]')];
  if (items.length === 0) return;

  root.classList.add('motion-ready');

  const step = reduced ? 0.03 : 0.075;
  const duration = reduced ? 0.4 : 0.85;

  await Promise.all(
    items.map((el, i) =>
      animate(
        el,
        /* Movement is dropped entirely under reduced motion; the fade stays, at
           full duration, so the page still arrives rather than snapping in. */
        reduced
          ? { opacity: [0, 1] }
          : { opacity: [0, 1], transform: ['translateY(18px)', 'translateY(0px)'] },
        { duration, delay: 0.05 + i * step, ease: EASE_OUT_EXPO },
      ).finished,
    ),
  );

  /* Hand the final state back to CSS. The gate class is what holds these at
     opacity 0, so removing it once is cleaner than leaving a WAAPI fill on
     every element and hoping nothing else wants to animate them later. */
  root.classList.remove('motion-ready');
};

/* --------------------------------------------------------------- REVEALS ---
   The same class toggle the CSS already reacts to.

   `threshold: 0.15` rather than a bare root margin: a tall section should begin
   when a sixth of it has arrived, not the instant its top edge crosses a line,
   which is what made long sections fire late and short ones fire early. */
const startReveals = () => {
  const targets = document.querySelectorAll<HTMLElement>('.reveal');
  if (targets.length === 0 || !('IntersectionObserver' in window)) return;

  root.classList.add('reveal-ready');

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
  );

  targets.forEach((el) => io.observe(el));
};

/* Reveals wait for the entrance so the two never overlap. An element arriving
   while the hero is still assembling reads as a stampede, and that overlap was
   most of why the old timing felt busy rather than composed. */
const start = async () => {
  startScroll();
  await runEntrance();
  startReveals();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
