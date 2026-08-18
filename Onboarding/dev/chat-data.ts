/**
 * Dev fixtures for Hud's chat.
 *
 * Keyword routing, not a model, and it matters that it stays obviously dumb: a
 * stub that appears to reason invites the front end to be built against
 * behaviour the real service never promised.
 *
 * What it DOES reproduce faithfully is the one rule that carries the product's
 * argument. Hud talks in `text`, but anything the user might act on is ATTACHED,
 * never described: a posting arrives as a JobMatch and a course as a Course, so
 * the screen renders them through MatchCard and CourseCard and they bring their
 * own `why`, `source` and confidence with them. If an edit here makes it easy to
 * write a job title into the prose instead, the same edit would be easy to make
 * in production, which is why the types keep those fields separate.
 *
 * This file does not ship.
 */
import { courses, dashboard, jobs, type Locale } from './data.js';

type Bi = { ar: string; en: string };
const pick = (b: Bi, l: Locale) => b[l];

const message = (
  text: string,
  extra: {
    jobs?: unknown[];
    courses?: unknown[];
    suggestions?: string[];
  } = {},
) => ({
  id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  role: 'hud' as const,
  text,
  ...extra,
  createdAt: Date.now(),
});

/** The three openers, reused as follow-up chips so the wording stays consistent. */
export const chatSuggestions = (l: Locale) => [
  pick({ ar: 'لا أعرف أي وظيفة أريد', en: 'I do not know what job I want' }, l),
  pick({ ar: 'أحتاج مساعدة في مهاراتي', en: 'I need help with my skills' }, l),
  pick({ ar: 'أي دورة آخذها بعد؟', en: 'Which course should I take next?' }, l),
];

const rolesAnswer = (l: Locale) =>
  message(
    pick({
      ar: 'بالنظر إلى مقرراتك، أقرب ثلاثة أدوار هي محلل بيانات، ومطوّر تقارير أعمال، ومساعد إدارة قواعد بيانات. أقربها محلل بيانات: نظم قواعد البيانات 2 يوثّق SQL، و إحصاء للمهندسين يوثّق التحليل الإحصائي، والاثنان مطلوبان في أغلب إعلانات هذا الدور في مسقط. ما يتبقى هو أدوات لوحات المعلومات. وهذه وظيفتان معروضتان الآن يغطيهما ما تملكه بالفعل.',
      en: 'Reading your courses, the three closest roles are data analyst, business reporting developer and junior database administrator. Data analyst is the nearest: Database Systems II evidences SQL and Statistics for Engineers evidences statistical analysis, and both are asked for in most postings for that role in Muscat. What remains is dashboard tooling. Here are two openings live right now that what you already hold covers.',
    }, l),
    {
      jobs: jobs(l).slice(0, 2),
      suggestions: [
        pick({ ar: 'ما الذي ينقصني لأصل إلى محلل بيانات؟', en: 'What is between me and data analyst?' }, l),
        pick({ ar: 'أي دورة آخذها بعد؟', en: 'Which course should I take next?' }, l),
      ],
    },
  );

const skillsAnswer = (l: Locale) => {
  const d = dashboard(l);
  return message(
    pick({
      ar: `أبدأ بما تملكه، لأنه النصف الأنفع: ${d.strengths.join('، ')}، وكل واحدة منها موثّقة بمقرر بعينه في كشف درجاتك. أما ما لم يوثّقه سجلك بعد فهو ${d.gaps.join(' و')}. وهاتان دورتان تغلقان الفجوتين.`,
      en: `Starting with what you have, because it is the more useful half: ${d.strengths.join(', ')}, each traced to a named course in your transcript. What your record does not evidence yet is ${d.gaps.join(' and ')}. These two courses close those gaps.`,
    }, l),
    {
      courses: [courses(l)[0], courses(l)[2]],
      suggestions: [
        pick({ ar: 'أي وظائف تناسبني اليوم؟', en: 'Which jobs fit me today?' }, l),
        pick({ ar: 'لا أعرف أي وظيفة أريد', en: 'I do not know what job I want' }, l),
      ],
    },
  );
};

const coursesAnswer = (l: Locale) =>
  message(
    pick({
      ar: 'أكبر فجوة واحدة أمامك هي Power BI: ثلاثة من الأدوار المرصودة تطلبه صراحةً، ولا يوثّقه أي مقرر في كشف درجاتك. لذلك أبدأ به. وكل دورة هنا من كتالوج موثّق ومربوطة بالفجوة التي تغلقها، ولا أقترح ما لا أستطيع إحالتك إليه.',
      en: 'The single largest gap in front of you is Power BI: three of the tracked roles ask for it by name and no course in your transcript evidences it, so that is where I would start. Every course here comes from a verified catalogue and is tied to the gap it closes. I do not suggest anything I cannot link you to.',
    }, l),
    {
      courses: courses(l),
      suggestions: [
        pick({ ar: 'أي وظائف تناسبني اليوم؟', en: 'Which jobs fit me today?' }, l),
        pick({ ar: 'أحتاج مساعدة في مهاراتي', en: 'I need help with my skills' }, l),
      ],
    },
  );

const jobsAnswer = (l: Locale) =>
  message(
    pick({
      ar: 'هذه وظائف معروضة فعلاً، ولكلٍّ منها سببها ومصدرها بتاريخ رصده. افتح المصدر إن أردت التحقق بنفسك، فأنا لا أطلب منك أن تأخذ كلامي مجرداً.',
      en: 'These are genuinely live postings, each with its reason and its source carrying the date it was retrieved. Open the source if you want to check for yourself; I am not asking you to take my word for it.',
    }, l),
    {
      jobs: jobs(l),
      suggestions: [
        pick({ ar: 'لماذا تناسبني هذه؟', en: 'Why do these fit me?' }, l),
        pick({ ar: 'أي دورة آخذها بعد؟', en: 'Which course should I take next?' }, l),
      ],
    },
  );

/**
 * The honest miss.
 *
 * It offers the three openers back rather than a best guess, because on this
 * product a confident wrong answer costs more than an admitted one.
 */
const unsureAnswer = (l: Locale) =>
  message(
    pick({
      ar: 'لم أفهم هذا بما يكفي لأبني عليه، ولا أريد أن أخمّن. أستطيع أن أنظر في سجلك من ثلاث جهات: الأدوار التي تقف قريباً منها، وما تملكه من مهارات وما ينقصه، والدورات التي تغلق الفجوة.',
      en: 'I did not understand that well enough to build on it, and I would rather not guess. I can look at your record from three directions: the roles you are standing near, the skills you hold and the ones you do not, and the courses that close the gap.',
    }, l),
    { suggestions: chatSuggestions(l) },
  );

/**
 * What Hud says when a file arrives.
 *
 * Careful, and deliberately unimpressive. Reading documents is a pipeline run
 * with a human confirmation screen in the middle of it — that is the product's
 * first trust moment. A chat that quietly swallowed a file and started talking
 * about its contents would be claiming to have done something it has not, and
 * would route around the one screen that exists to be checked.
 *
 * So this acknowledges the file by name, says plainly what it is not, and points
 * at the place that does read documents properly.
 */
export const chatAttachmentReply = (l: Locale, names: string[]) =>
  message(
    pick({
      ar: `وصلني ${names.join('، ')}. لم أقرأه بعد: قراءة المستندات تجري في صفحة المستندات، وفيها شاشة تراجع فيها ما استُخرج قبل أن يُبنى عليه أي شيء، وهي خطوة لا أتجاوزها. أما هنا فاسألني عمّا تريد وسأجيب من سجلك كما هو الآن.`,
      en: `Got ${names.join(', ')}. I have not read it yet: documents are read on the Documents page, where you check what was extracted before anything is built on it, and that is a step I do not skip. Here, ask me what you want and I will answer from your record as it stands.`,
    }, l),
    { suggestions: chatSuggestions(l) },
  );

const has = (q: string, words: string[]) => words.some((w) => q.includes(w));

/** Routes a question to an answer. */
export const chatAnswer = (l: Locale, question: string) => {
  const q = question.toLowerCase();
  if (has(q, ['what job', 'which job', 'role', 'career', 'suit', 'fit me', 'أي وظيفة', 'دور', 'مهنة', 'مسار', 'يناسب'])) {
    return rolesAnswer(l);
  }
  if (has(q, ['course', 'learn', 'study', 'training', 'دورة', 'دورات', 'أتعلم', 'تعلم', 'تدريب'])) {
    return coursesAnswer(l);
  }
  if (has(q, ['skill', 'gap', 'strength', 'between me', 'مهار', 'فجوة', 'نقاط', 'ينقصني'])) {
    return skillsAnswer(l);
  }
  if (has(q, ['job', 'vacanc', 'apply', 'hiring', 'posting', 'وظيف', 'وظائف', 'تقديم', 'شاغر'])) {
    return jobsAnswer(l);
  }
  return unsureAnswer(l);
};
