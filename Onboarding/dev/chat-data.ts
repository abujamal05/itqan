/**
 * Dev fixtures for Hud's chat.
 *
 * Keyword routing, not a model, and it matters that it stays obviously dumb: a
 * stub that appears to reason invites the front end to be built against
 * behaviour the real service never promised. What it DOES reproduce faithfully
 * is the part of the contract that carries the product's argument — every fork
 * of kind role, course or job carries a `why` and a real `source`, and `read`
 * is orientation only, never a verdict, a score or a match. If an edit here
 * makes it easy to drop either, the same edit would be easy to make in
 * production, which is the whole reason the shape is enforced by the types.
 *
 * Forks reuse the job and course fixtures wholesale, because the screen renders
 * those through MatchCard and CourseCard rather than reimplementing them.
 *
 * This file does not ship.
 */
import { courses, jobs, type Locale } from './data.js';

type Bi = { ar: string; en: string };
const pick = (b: Bi, l: Locale) => b[l];

const RETRIEVED = '2026-07-24';

const roleSource = (l: Locale) => ({
  name: pick({ ar: 'إعلانات الوظائف المرصودة، يوليو 2026', en: 'Tracked job postings, July 2026' }, l),
  url: 'https://example.com/postings?role=data-analyst',
  retrievedAt: RETRIEVED,
});

const junction = (
  id: string,
  question: string | null,
  read: string,
  forks: unknown[],
  parentId: string | null = null,
) => ({ id, question, read, forks, takenForkId: null, parentId, createdAt: Date.now() });

/** Junction zero. Opens a thread, and is also the screen's empty state. */
export const chatOpening = (l: Locale) =>
  junction(
    'j0',
    null,
    pick({
      ar: 'أهلاً. أنا هد. أستطيع النظر في سجلك من ثلاث جهات، وكل واحدة تقودك إلى مكان مختلف. اختر ما يشبه سؤالك.',
      en: 'Hello. I am Hud. I can look at your record from three directions, and each one leads somewhere different. Pick whichever is closest to what you are asking.',
    }, l),
    [
      {
        id: 'f-roles',
        kind: 'topic',
        label: pick({ ar: 'لا أعرف أي وظيفة أريد', en: 'I do not know what job I want' }, l),
        detail: pick({
          ar: 'أبدأ من مقرراتك، وأريك الأدوار التي تقف قريباً منها بالفعل.',
          en: 'I start from your courses and show you the roles you are already standing near.',
        }, l),
      },
      {
        id: 'f-skills',
        kind: 'topic',
        label: pick({ ar: 'أحتاج مساعدة في مهاراتي', en: 'I need help with my skills' }, l),
        detail: pick({
          ar: 'ما يوثّقه كشف درجاتك، وما لم يوثّقه بعد.',
          en: 'What your transcript evidences, and what it does not evidence yet.',
        }, l),
      },
      {
        id: 'f-courses',
        kind: 'topic',
        label: pick({ ar: 'أي دورة آخذها بعد؟', en: 'Which course should I take next?' }, l),
        detail: pick({
          ar: 'دورات حقيقية من كتالوج موثّق، مرتبة بما تفتحه لك.',
          en: 'Real courses from a verified catalogue, ordered by what each one opens up.',
        }, l),
      },
    ],
  );

const rolesJunction = (l: Locale, question: string | null) =>
  junction('j-roles', question, pick({
    ar: 'هذه ثلاثة أدوار يشير إليها سجلك. لكلٍّ منها سبب مأخوذ من مقرراتك، لا من تخميني.',
    en: 'Here are three roles your record points at. Each one carries its reason, taken from your courses rather than from my guessing.',
  }, l), [
    {
      id: 'f-role-analyst',
      kind: 'role',
      label: pick({ ar: 'محلل بيانات', en: 'Data analyst' }, l),
      detail: pick({
        ar: 'تملك SQL والتحليل الإحصائي. تبقى أدوات لوحات المعلومات.',
        en: 'You already have SQL and statistical analysis. Dashboard tooling is what remains.',
      }, l),
      why: pick({
        ar: 'نظم قواعد البيانات 2 يوثّق SQL، و إحصاء للمهندسين يوثّق التحليل الإحصائي. الاثنان مطلوبان في أغلب إعلانات هذا الدور في مسقط.',
        en: 'Database Systems II evidences SQL and Statistics for Engineers evidences statistical analysis. Both are asked for in most postings for this role in Muscat.',
      }, l),
      confidence: 0.91,
      source: roleSource(l),
    },
    {
      id: 'f-role-bi',
      kind: 'role',
      label: pick({ ar: 'مطوّر تقارير أعمال', en: 'Business reporting developer' }, l),
      detail: pick({
        ar: 'أقرب إلى ما تملكه، غير أن الأدوات نفسها ما زالت فجوة.',
        en: 'Closer to what you hold, though the same tooling is still a gap.',
      }, l),
      why: pick({
        ar: 'الدور يقوم على SQL وعرض البيانات. الأول موثّق في كشف درجاتك، والثاني هو ما تفتحه دورة Power BI.',
        en: 'The role rests on SQL and on presenting data. The first is evidenced in your transcript, and the second is what the Power BI course opens.',
      }, l),
      confidence: 0.78,
      source: roleSource(l),
    },
    {
      id: 'f-role-db',
      kind: 'role',
      label: pick({ ar: 'مساعد إدارة قواعد بيانات', en: 'Junior database administrator' }, l),
      detail: pick({
        ar: 'مسار أطول، لكنه مبني على أقوى ما لديك.',
        en: 'A longer path, but built on your strongest evidence.',
      }, l),
      why: pick({
        ar: 'أقوى ما في سجلك هو قواعد البيانات، وهذا الدور يبني عليه مباشرة. ويطلب خبرة تشغيلية لا يوثّقها كشف الدرجات بعد.',
        en: 'Databases are the strongest thing in your record and this role builds directly on that. It also asks for operational experience the transcript does not evidence yet.',
      }, l),
      confidence: 0.64,
      source: roleSource(l),
    },
  ]);

const skillsJunction = (l: Locale, question: string | null) =>
  junction('j-skills', question, pick({
    ar: 'أبدأ بما تملكه، لأنه النصف الأنفع. ثم ما لم يوثّقه سجلك بعد.',
    en: 'I start with what you have, because it is the more useful half. Then what your record does not evidence yet.',
  }, l), [
    {
      id: 'f-skill-held',
      kind: 'topic',
      label: pick({ ar: 'ما تملكه بالفعل', en: 'What you already have' }, l),
      detail: pick({
        ar: 'SQL، والتحليل الإحصائي، وPython، كلها موثّقة بمقرر بعينه.',
        en: 'SQL, statistical analysis and Python, each traced to a named course.',
      }, l),
    },
    {
      id: 'f-skill-powerbi',
      kind: 'course',
      label: pick({ ar: 'افتح Power BI', en: 'Unlock Power BI' }, l),
      detail: pick({
        ar: 'أكبر فجوة واحدة أمام أدوار التحليل المعروضة عليك.',
        en: 'The single largest gap in front of the analysis roles shown to you.',
      }, l),
      why: pick({
        ar: 'ثلاثة من الأدوار المرصودة تطلب Power BI صراحةً، ولا يوثّقه أي مقرر في كشف درجاتك.',
        en: 'Three of the tracked roles ask for Power BI by name, and no course in your transcript evidences it.',
      }, l),
      confidence: 0.88,
      source: roleSource(l),
      course: courses(l)[0],
    },
    {
      id: 'f-skill-comm',
      kind: 'course',
      label: pick({ ar: 'افتح التواصل المهني', en: 'Unlock professional communication' }, l),
      detail: pick({
        ar: 'مطلوب في الإعلانات أكثر مما تُظهره.',
        en: 'Asked for more often than the postings let on.',
      }, l),
      why: pick({
        ar: 'كتابة التقارير الفنية تظهر في سجلك بثقة منخفضة، وهي وحدها لا تغطي ما تطلبه الإعلانات هنا.',
        en: 'Technical Report Writing appears in your record at low confidence, and on its own it does not cover what the postings ask for here.',
      }, l),
      confidence: 0.63,
      source: roleSource(l),
      course: courses(l)[2],
    },
  ]);

const coursesJunction = (l: Locale, question: string | null) =>
  junction('j-courses', question, pick({
    ar: 'كل دورة هنا من كتالوج موثّق، ومربوطة بالفجوة التي تغلقها. لا أقترح ما لا أستطيع إحالتك إليه.',
    en: 'Every course here comes from a verified catalogue and is tied to the gap it closes. I do not suggest anything I cannot link you to.',
  }, l), courses(l).map((c, i) => ({
    id: `f-course-${c.id}`,
    kind: 'course',
    label: c.title,
    detail: pick({
      ar: `يفتح ${c.unlocks.join('، ')}`,
      en: `Unlocks ${c.unlocks.join(', ')}`,
    }, l),
    why: pick({
      ar: `اخترته لأنه يغطي ${c.unlocks[0]}، وهو مطلوب في الأدوار المعروضة عليك وغير موثّق في كشف درجاتك.`,
      en: `Picked because it covers ${c.unlocks[0]}, which the roles shown to you ask for and your transcript does not evidence.`,
    }, l),
    confidence: [0.88, 0.74, 0.61][i] ?? 0.6,
    source: c.source,
    course: c,
  })));

const jobsJunction = (l: Locale, question: string | null) =>
  junction('j-jobs', question, pick({
    ar: 'هذه وظائف معروضة فعلاً، ولكلٍّ منها سببها ومصدرها بتاريخ رصده. افتح المصدر إن أردت التحقق بنفسك.',
    en: 'These are genuinely live postings, each with its reason and its source carrying the date it was retrieved. Open the source if you want to check for yourself.',
  }, l), jobs(l).slice(0, 2).map((j) => ({
    id: `f-job-${j.id}`,
    kind: 'job',
    label: j.title,
    detail: `${j.employer} · ${j.location}`,
    why: j.why,
    confidence: j.score,
    source: j.source,
    job: j,
  })));

/**
 * A junction that admits it did not understand.
 *
 * It offers the three ways back in rather than a best guess, which is the
 * honest failure for this product: a confident wrong direction costs more than
 * an admitted miss.
 */
const unsureJunction = (l: Locale, question: string) =>
  junction('j-unsure', question, pick({
    ar: 'لم أفهم هذا بما يكفي لأبني عليه. وبدل أن أخمّن، هذه الجهات الثلاث التي أستطيع النظر منها.',
    en: 'I did not understand that well enough to build on it. Rather than guess, here are the three directions I can look from.',
  }, l), chatOpening(l).forks);

const has = (q: string, words: string[]) => words.some((w) => q.includes(w));

/** Routes a free text question to the junction it opens. */
export const chatAnswer = (l: Locale, question: string) => {
  const q = question.toLowerCase();
  if (has(q, ['job', 'vacanc', 'apply', 'hiring', 'posting', 'وظيف', 'وظائف', 'تقديم', 'شاغر'])) {
    return jobsJunction(l, question);
  }
  if (has(q, ['course', 'learn', 'study', 'training', 'دورة', 'دورات', 'أتعلم', 'تعلم', 'تدريب'])) {
    return coursesJunction(l, question);
  }
  if (has(q, ['skill', 'gap', 'strength', 'مهار', 'فجوة', 'نقاط'])) {
    return skillsJunction(l, question);
  }
  if (has(q, ['role', 'career', 'what job', 'suit', 'fit', 'دور', 'مهنة', 'مسار', 'يناسب'])) {
    return rolesJunction(l, question);
  }
  return unsureJunction(l, question);
};

/** Where each fork leads when it is walked. */
export const chatFork = (l: Locale, forkId: string) => {
  if (forkId === 'f-roles') return rolesJunction(l, null);
  if (forkId.startsWith('f-role-')) return jobsJunction(l, null);
  if (forkId === 'f-skills' || forkId === 'f-skill-held') return skillsJunction(l, null);
  if (forkId === 'f-courses' || forkId.startsWith('f-skill-')) return coursesJunction(l, null);
  if (forkId.startsWith('f-course-')) return jobsJunction(l, null);
  if (forkId.startsWith('f-job-')) return skillsJunction(l, null);
  return chatOpening(l);
};
