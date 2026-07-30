/**
 * Dev fixtures for the agent services.
 *
 * Two deliberate choices carried over from the earlier mock:
 *
 *  1. The data is REAL-SHAPED, not lorem ipsum: Omani employers, mixed
 *     Arabic/English strings, long names. Fake content hides the bidi and
 *     overflow bugs that only appear with real strings.
 *  2. The extraction is IMPERFECT ON PURPOSE. Dates OCR badly in practice, so
 *     the birth date comes back below the trust threshold and two skills are
 *     shaky. That makes "Suggested — confirm" a normal path, not a rare one.
 *
 * This file does not ship. In production these are the real services.
 */
export type Locale = 'ar' | 'en';
type Bi = { ar: string; en: string };
const pick = (b: Bi, l: Locale) => b[l];

export const analysisResult = (l: Locale) => ({
  fullName: {
    value: pick({ ar: 'مريم بنت سالم البلوشية', en: 'Maryam Salim Al Balushi' }, l),
    confidence: 0.96,
    evidence: pick({ ar: 'ترويسة كشف الدرجات', en: 'Transcript header' }, l),
  },
  birthDate: {
    value: '2001-04-12',
    confidence: 0.71,                       // scanned dates are the weak field
    evidence: pick({ ar: 'صفحة البيانات الشخصية', en: 'Personal details page' }, l),
  },
  graduationDate: {
    value: '2025-06',
    confidence: 0.9,
    evidence: pick({ ar: 'تاريخ منح الشهادة', en: 'Date of award' }, l),
  },
  skills: [
    { id: 's1', name: 'SQL', confidence: 0.94, fromCourse: pick({ ar: 'نظم قواعد البيانات 2', en: 'Database Systems II' }, l) },
    { id: 's2', name: pick({ ar: 'التحليل الإحصائي', en: 'Statistical analysis' }, l), confidence: 0.92, fromCourse: pick({ ar: 'إحصاء للمهندسين', en: 'Statistics for Engineers' }, l) },
    { id: 's3', name: 'Python', confidence: 0.89, fromCourse: pick({ ar: 'أساسيات البرمجة', en: 'Programming Fundamentals' }, l) },
    { id: 's4', name: pick({ ar: 'إدارة الشبكات', en: 'Network administration' }, l), confidence: 0.68, fromCourse: pick({ ar: 'شبكات الحاسوب', en: 'Computer Networks' }, l) },
    { id: 's5', name: pick({ ar: 'الكتابة التقنية', en: 'Technical writing' }, l), confidence: 0.63, fromCourse: pick({ ar: 'كتابة التقارير الفنية', en: 'Technical Report Writing' }, l) },
  ],
});

export const jobs = (l: Locale) => [
  {
    id: 'j1',
    title: pick({ ar: 'محلل بيانات مبتدئ', en: 'Junior Data Analyst' }, l),
    employer: pick({ ar: 'بنك مسقط', en: 'Bank Muscat' }, l),
    location: pick({ ar: 'مسقط، عُمان', en: 'Muscat, Oman' }, l),
    arrangement: pick({ ar: 'دوام كامل', en: 'Full time' }, l),
    score: 0.94,
    why: pick({
      ar: 'يطلب الإعلان SQL والتحليل الإحصائي. كشف درجاتك يوثّق الاثنين: نظم قواعد البيانات 2 و إحصاء للمهندسين.',
      en: 'The posting asks for SQL and statistical analysis. Your transcript evidences both, through Database Systems II and Statistics for Engineers.',
    }, l),
    matchedSkills: ['SQL', pick({ ar: 'التحليل الإحصائي', en: 'Statistical analysis' }, l)],
    source: { name: 'Bank Muscat Careers', url: 'https://example.com/postings/j1', retrievedAt: '2026-07-24' },
  },
  {
    id: 'j2',
    title: pick({ ar: 'أخصائي دعم تقني', en: 'IT Support Specialist' }, l),
    employer: 'Oman LNG',
    location: pick({ ar: 'صور، عُمان', en: 'Sur, Oman' }, l),
    arrangement: pick({ ar: 'دوام كامل', en: 'Full time' }, l),
    score: 0.88,
    why: pick({
      ar: 'الدور يعتمد على أساسيات الشبكات، وهي مغطاة بمادة شبكات الحاسوب في كشف درجاتك.',
      en: 'The role rests on networking fundamentals, which your Computer Networks course covers.',
    }, l),
    matchedSkills: [pick({ ar: 'إدارة الشبكات', en: 'Network administration' }, l)],
    source: { name: 'Oman LNG Careers', url: 'https://example.com/postings/j2', retrievedAt: '2026-07-23' },
  },
  {
    id: 'j3',
    title: pick({ ar: 'متدرب ذكاء الأعمال', en: 'Business Intelligence Trainee' }, l),
    employer: pick({ ar: 'مجموعة أسياد', en: 'Asyad Group' }, l),
    location: pick({ ar: 'مسقط، عُمان', en: 'Muscat, Oman' }, l),
    arrangement: pick({ ar: 'عمل مرن', en: 'Hybrid' }, l),
    score: 0.79,
    why: pick({
      ar: 'تتطابق مهاراتك في البيانات مع جزء من المطلوب. يطلب الإعلان أيضاً Power BI، وهي غير موثّقة في كشف درجاتك بعد.',
      en: 'Your data skills cover part of what is asked. The posting also wants Power BI, which your transcript does not yet evidence.',
    }, l),
    matchedSkills: ['SQL'],
    source: { name: 'Asyad Careers', url: 'https://example.com/postings/j3', retrievedAt: '2026-07-22' },
  },
  {
    id: 'j4',
    title: pick({ ar: 'مهندس برمجيات (خريج)', en: 'Software Engineer (Graduate)' }, l),
    employer: pick({ ar: 'ثواني للتقنية', en: 'Thawani Technologies' }, l),
    location: pick({ ar: 'مسقط، عُمان', en: 'Muscat, Oman' }, l),
    arrangement: pick({ ar: 'دوام كامل', en: 'Full time' }, l),
    score: 0.74,
    why: pick({
      ar: 'أساسيات البرمجة لديك تغطي Python. يطلب الدور خبرة في الأطر البرمجية للويب، وهي غير ظاهرة في كشف درجاتك.',
      en: 'Your programming fundamentals cover Python. The role also asks for web framework experience, which does not appear in your transcript.',
    }, l),
    matchedSkills: ['Python'],
    source: { name: 'Thawani Careers', url: 'https://example.com/postings/j4', retrievedAt: '2026-07-21' },
  },
];

export const courses = (l: Locale) => [
  {
    id: 'c1',
    title: pick({ ar: 'Power BI من الأساس', en: 'Power BI from the ground up' }, l),
    provider: 'Microsoft Learn',
    hours: 8,
    price: 0, currency: 'OMR',
    unlocks: ['Power BI', pick({ ar: 'لوحات المعلومات', en: 'Dashboards' }, l)],
    recommended: true,
    source: { name: 'Microsoft Learn', url: 'https://example.com/courses/c1', retrievedAt: '2026-07-24' },
  },
  {
    id: 'c2',
    title: pick({ ar: 'SQL للتحليل العملي', en: 'SQL for practical analysis' }, l),
    provider: 'Coursera / Google',
    hours: 12,
    price: 18, currency: 'OMR',
    unlocks: ['SQL', pick({ ar: 'نمذجة البيانات', en: 'Data modelling' }, l)],
    recommended: false,
    source: { name: 'Coursera', url: 'https://example.com/courses/c2', retrievedAt: '2026-07-24' },
  },
  {
    id: 'c3',
    title: pick({ ar: 'التواصل المهني في بيئة العمل', en: 'Professional communication at work' }, l),
    provider: pick({ ar: 'إدراك', en: 'Edraak' }, l),
    hours: 6,
    price: 0, currency: 'OMR',
    unlocks: [pick({ ar: 'التواصل المهني', en: 'Professional communication' }, l)],
    recommended: false,
    source: { name: 'Edraak', url: 'https://example.com/courses/c3', retrievedAt: '2026-07-20' },
  },
];

export const dashboard = (l: Locale) => ({
  readiness: 72,
  readinessNote: pick({
    ar: 'كشف درجاتك يوثّق معظم ما تطلبه أدوار تحليل البيانات المبتدئة في عُمان. أكبر فجوة واحدة هي أدوات لوحات المعلومات.',
    en: 'Your transcript evidences most of what entry level data roles in Oman ask for. The single largest gap is dashboard tooling.',
  }, l),
  strengths: ['SQL', pick({ ar: 'التحليل الإحصائي', en: 'Statistical analysis' }, l), 'Python'],
  standings: [
    { name: 'SQL', level: 0.9, held: true },
    { name: pick({ ar: 'التحليل الإحصائي', en: 'Statistical analysis' }, l), level: 0.85, held: true },
    { name: 'Python', level: 0.7, held: true },
    { name: 'Power BI', level: 0.15, held: false },
    { name: pick({ ar: 'التواصل المهني', en: 'Professional communication' }, l), level: 0.3, held: false },
  ],
  topMatches: jobs(l).slice(0, 2),
  gaps: ['Power BI', pick({ ar: 'التواصل المهني', en: 'Professional communication' }, l)],
  nextStep: {
    title: pick({ ar: 'أضف Power BI إلى أدواتك', en: 'Add Power BI to your toolkit' }, l),
    body: pick({
      ar: 'ثلاثة من الأدوار المعروضة عليك تطلب Power BI. دورة واحدة مدتها 8 ساعات تغطي المطلوب منها.',
      en: 'Three of the roles shown to you ask for Power BI. One 8 hour course covers what they need.',
    }, l),
    action: 'courses' as const,
  },
  journey: [
    { id: 'read',    label: pick({ ar: 'قراءة مستنداتك', en: 'Reading your documents' }, l),
      state: 'done',     detail: pick({ ar: 'اكتملت 24 يوليو', en: 'Completed 24 Jul' }, l) },
    { id: 'skills',  label: pick({ ar: 'تحديد مهاراتك', en: 'Identifying your skills' }, l),
      state: 'done',     detail: pick({ ar: 'اكتملت 24 يوليو', en: 'Completed 24 Jul' }, l) },
    { id: 'courses', label: pick({ ar: 'مطابقة الدورات', en: 'Matching courses' }, l),
      state: 'current',  detail: pick({ ar: 'المرحلة الحالية', en: 'Where you are now' }, l) },
    { id: 'jobs',    label: pick({ ar: 'التقديم على الوظائف', en: 'Applying for jobs' }, l),
      state: 'upcoming', detail: pick({ ar: 'الخطوة القادمة', en: 'Next milestone' }, l) },
  ],
});

/**
 * The synchronous pipeline envelope, shaped exactly like the production
 * contract in `Onboarding/src/api/agents.ts` (snake_case, `{en, ar}` pairs).
 *
 * This is deliberately NOT the old UI-shaped `analysisResult`. Dev must
 * exercise the same mapping code production will, or the mapper is only ever
 * tested in production — which is how the last dev/prod drift bug happened.
 */
export const pipelineResult = (l: Locale) => {
  const bi = (en: string, ar: string) => ({ en, ar });
  void l; // both languages are sent; the client picks. Kept for signature parity.
  return {
    run_id: `run_${Date.now().toString(36)}`,
    candidate_profile: {
      candidate_id: 'u_maryam',
      full_name: { value: 'Maryam Salim Al Balushi', confidence: 0.96, evidence_quote: 'Maryam Salim Al Balushi' },
      email: null,
      phone: null,
      birth_date: { value: '2001-04-12', confidence: 0.71, evidence_quote: 'D.O.B 12/04/2001' },
      graduation_date: { value: '2025-06', confidence: 0.9, evidence_quote: 'Date of award: June 2025' },
      education: [],
      skills: [
        { name: 'SQL', origin: 'coursework_derived', quality: 'medium',
          evidence_quote: 'Database Systems II — A', from_course: 'Database Systems II', esco_code: 'S1.2.3' },
        { name: 'Python', origin: 'project', quality: 'high',
          evidence_quote: 'Built an inventory tracker in Python', from_course: null, esco_code: 'S1.1.1' },
        { name: 'Technical writing', origin: 'claim_only', quality: 'low',
          evidence_quote: null, from_course: null, esco_code: null },
      ],
      confidence: { overall: 0.91 },
      provenance: {
        source_documents: ['doc_dev'],
        unresolved_gaps: ['phone number not found'],
        extracted_at: new Date().toISOString(),
      },
    },
    skill_gap: {
      candidate_id: 'u_maryam',
      generated_at: new Date().toISOString(),
      postings: [],
      aggregate: {
        missing_skill_details: [
          { skill: 'Power BI', skill_label: bi('Power BI', 'باور بي آي'),
            esco_code: 'S1.4.7', priority_score: 3.21, demand_trend: 'rising' },
        ],
        matched_skills: ['SQL', 'Python'],
        overall_gap_score: 0.42,
        overall_gap_score_range: [0.35, 0.55],
      },
    },
    course_recommendations: {
      candidate_id: 'u_maryam',
      generated_at: new Date().toISOString(),
      recommendations: [],
      no_course_found: [],
    },
    warnings: [],
  };
};
