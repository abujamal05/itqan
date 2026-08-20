/**
 * How a skill name is shown.
 *
 * Skills reach the screen from two different worlds and only one of them is
 * lower-case. ESCO and the extractors produce `communication skills`,
 * `data modeling`, `project management`; the same lists also carry `SQL`,
 * `CI/CD`, `VB.NET`, `C#.NET` and `Power BI`, which people wrote deliberately.
 *
 * So this raises the first letter of a word ONLY when the whole word is
 * lower-case. A word containing any capital is somebody's intended spelling and
 * is left exactly alone.
 *
 * **Not `text-transform: capitalize`**, which is the obvious thing and is wrong:
 * CSS would render `Sql`, `Ci/Cd` and `Vb.net`, turning real names into
 * misspellings — and it would do it invisibly, because the underlying string
 * stays correct and only the pixels lie. Doing this in code means the rule can
 * be tested, which is the whole reason it is here rather than in a stylesheet.
 */

/** Word boundaries that should each get their own capital: spaces and slashes. */
const PARTS = /([ /])/;

const raiseWord = (word: string): string =>
  // `toLowerCase()` comparison rather than a regex, so it holds for Arabic and
  // any other script where "has no capitals" is the normal state — those words
  // are returned untouched, which is correct: they have no case to raise.
  word === word.toLowerCase() && word !== word.toUpperCase()
    ? word.charAt(0).toUpperCase() + word.slice(1)
    : word;

export function skillCase(name: string): string {
  return (name ?? '')
    .split(PARTS)
    .map((part) => (PARTS.test(part) ? part : raiseWord(part)))
    .join('');
}
