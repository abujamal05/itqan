/**
 * Copy rules, checked against the locale files.
 *
 * WHY THIS EXISTS. The marketing site has `scripts/audit.py`, which enforces
 * the no-dashes rule among others. This app had nothing, and the rule is
 * written to apply to BOTH halves of the product. Fourteen violations had
 * accumulated here and nothing was going to find them: tsc does not read
 * prose, eslint does not read JSON, and the site's auditor never looks in this
 * directory.
 *
 * Deliberately small. It checks the things that are objectively true or false
 * about a string, and leaves judgement to a person. A copy checker that tries
 * to have taste produces arguments rather than fixes.
 *
 *   npm run check:copy
 */
import { readFileSync } from 'node:fs';

const LOCALES = ['en', 'ar'];
const dict = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(`src/i18n/${l}.json`, 'utf8'))]),
);

/* The one sanctioned dash in the product, in both languages. Copied verbatim
   rather than matched loosely: the point of an exception list is that it names
   exactly what is allowed. */
const DASH_EXCEPTIONS = new Set(['Suggested — confirm', 'مقترح — أكّد']);

/* Hype vocabulary, kept in step with `itqan-website/scripts/audit.py`. Not the
   full list there — the ones that would actually show up in product UI. */
const HYPE = [
  'revolutionary', 'magical', 'seamless', 'effortless', 'game-changer',
  'cutting-edge', 'unlock your potential', 'empower', 'leverage', 'delve',
  'elevate', 'robust', 'harness', 'supercharge', 'AI-powered', 'AI powered',
  'dream job', 'get hired', 'land the job',
];

/**
 * Gulf spoken forms that do not belong in the product's register.
 *
 * WHOLE WORDS ONLY, and that is not pedantry. A plain substring test flagged
 * `تقريبية` because the letters of `يبي` sit inside it, which is the kind of
 * false positive that gets a checker switched off within a week. The lookarounds
 * require an Arabic-letter boundary on each side.
 */
const DIALECT = ['عشان', 'اللي', 'تشوف', 'يبي', 'وش', 'ليش', 'هالشي', 'بكرة'].map((word) => ({
  word,
  re: new RegExp(`(?<![\\u0600-\\u06FF])${word}(?![\\u0600-\\u06FF])`),
}));

/* Multi-word forms, where the space already provides the boundary. */
DIALECT.push(
  { word: 'بدل ما', re: /بدل ما/ },
  { word: 'ما يشتغل', re: /ما يشتغل/ },
  { word: 'عشان كذا', re: /عشان كذا/ },
  { word: 'ما باقي', re: /ما باقي/ },
);

const problems = [];

for (const locale of LOCALES) {
  for (const [key, value] of Object.entries(dict[locale])) {
    if (typeof value !== 'string') continue;

    if ((value.includes('—') || value.includes('–')) && !DASH_EXCEPTIONS.has(value.trim())) {
      problems.push(`${locale}: ${key} — em or en dash in prose\n      ${value}`);
    }

    const hit = HYPE.find((w) => value.toLowerCase().includes(w.toLowerCase()));
    if (hit) problems.push(`${locale}: ${key} — hype vocabulary "${hit}"\n      ${value}`);

    /* Arabic carries its own punctuation. A Latin comma inside an Arabic
       string is the signature of text that was translated rather than
       written. */
    if (locale === 'ar' && /[؀-ۿ][,;]\s/.test(value)) {
      problems.push(`${locale}: ${key} — Latin comma or semicolon in Arabic, use ، and ؛\n      ${value}`);
    }

    /* DIALECT. The ruleset welcomes colloquial rhythm and bans colloquial
       grammar, and the difference is invisible to anyone reading the English.
       Four strings had drifted into Gulf spoken Arabic — عشان, اللي, تشوف,
       بدل ما — and nothing was going to catch them, because they are perfectly
       ordinary words that simply belong in speech rather than in a product. */
    if (locale === 'ar') {
      const found = DIALECT.find(({ re }) => re.test(value));
      if (found) {
        problems.push(`${locale}: ${key} — dialect "${found.word}", the register is modern standard Arabic\n      ${value}`);
      }
    }
  }
}

/* Parity, because `ar.json` types the dictionary: a key only in `en.json` is a
   type error at every use site, while one only in `ar.json` type-checks and
   then renders undefined in English. */
const [en, ar] = LOCALES.map((l) => new Set(Object.keys(dict[l])));
for (const k of en) if (!ar.has(k)) problems.push(`missing from ar.json: ${k}`);
for (const k of ar) if (!en.has(k)) problems.push(`missing from en.json: ${k}`);

if (problems.length) {
  console.error(`\ncheck-copy: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

const count = Object.keys(dict.en).length;
console.log(`check-copy: ${count} strings x ${LOCALES.length} locales, clean.`);
