/**
 * The Itqan mark. Same programme as the marketing site so the two read as one
 * product: the full-colour asset on light surfaces, the reversed one on dark.
 *
 * The swap is not decoration. Composited on navy, the full-colour lockup loses
 * its wordmark, crest tips, eye and beak — they are all navy — leaving a
 * broken bird with no name. Both files ship and CSS picks; no JS, no flash.
 *
 * `lockup` is the full horizontal mark (bilingual wordmark included) and is
 * used where the brand introduces itself. `icon` is the compact mark for
 * dense chrome. Below 140px the lockup is illegible, so narrow surfaces get
 * the icon instead of a squeezed lockup.
 */
type Variant = 'lockup' | 'icon';

const SRC: Record<Variant, { light: string; dark: string }> = {
  lockup: { light: '/logos/lockup-horizontal.webp', dark: '/logos/lockup-horizontal-reversed.webp' },
  icon: { light: '/logos/icon.webp', dark: '/logos/icon-reversed.webp' },
};

export function Logo({
  variant = 'lockup',
  height,
  className = '',
}: {
  variant?: Variant;
  height?: number;
  className?: string;
}) {
  const src = SRC[variant];
  const h = height ?? (variant === 'lockup' ? 34 : 36);
  return (
    <span className={`logo logo--${variant} ${className}`.trim()} style={{ blockSize: h }}>
      <img className="logo__img logo__img--light" src={src.light} alt="" width="512" height="150" />
      <img className="logo__img logo__img--dark" src={src.dark} alt="" width="512" height="150" />
    </span>
  );
}

/**
 * The mark as a link home, carrying the accessible name. The image itself stays
 * decorative so the name is announced once, not twice.
 */
export function BrandLink({ to, label, variant = 'lockup' }: { to: string; label: string; variant?: Variant }) {
  return (
    <a className="brand" href={to} aria-label={label}>
      <Logo variant={variant} />
    </a>
  );
}
