/**
 * How to reach Itqan. One address and one number for everything.
 *
 * NOT IN THE LOCALE FILES, because neither value is translatable and a string
 * duplicated across two locales is a string that will eventually disagree with
 * itself. The words around them are translated; these are not.
 *
 * DUPLICATED FROM `itqan-website/src/config.ts`, and that is a real seam. The
 * two front ends are separate builds with no shared package, and inventing one
 * to carry two strings would cost more than it saves. **If these change, they
 * change in three places: here, the website config, and the prose of the
 * Privacy Policy and Terms of Use, where the address sits inside a sentence in
 * both locales and cannot be interpolated without breaking one of them.**
 */
export const contact = {
  email: 'ItqanTeam@outlook.com',
  phone: '+968 7123 5872',
  /** `tel:` wants no spaces; the displayed form keeps them. */
  phoneHref: '+96871235872',
} as const;
