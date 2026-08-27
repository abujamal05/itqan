/**
 * Profile — who you are, and where you are heading.
 *
 * WHAT IS NOT HERE ANY MORE. This screen used to hold everything Itqan knows,
 * which grew to eight sections: someone looking for their document list scrolled
 * past their own birth date to find it. What the product HOLDS and DOES — the
 * skills it read, the documents it read them from, the AI allowance, the
 * preferences it matches against, support, and closing the account — moved to
 * `Settings.tsx`. What is left is the answer to "is this me, and is it right":
 * your details, your photo, the role you are working towards, and how to reach
 * a person. Both screens compose the same `<Section>` and `<Row>`, so the split
 * is a change of address rather than a change of design.
 *
 * Education went the other way and merged UP into personal details. It held one
 * field, and a card containing a single date between two substantial ones read
 * as something unfinished rather than as a category.
 *
 * Two decisions shape this screen.
 *
 * 1. It EDITS IN PLACE, section by section, rather than being one long form
 *    with a single save at the bottom. Most of what is here is already correct,
 *    so a form that puts every field into an input asks the user to re-check
 *    twenty things to change one. Each section is read only until they choose to
 *    edit it, and saves on its own.
 *
 * 2. It says plainly what is MISSING. The brief asks for a place to complete
 *    information, and a blank field with no label reads as a bug rather than an
 *    invitation. Anything absent is named and counted at the top, so the screen
 *    answers "is my profile finished" before it answers anything else.
 *
 * Hud is deliberately absent: the brand fences the mascot away from anything
 * that reads as a record of the user, and this is exactly that.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Camera, Mail, Phone, Target, User as UserIcon, X,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { errorText } from '../lib/errorText';
import { contact } from '../lib/contact';
import { useApi } from '../state/api';
import { useAuth } from '../state/auth';
import { useAsync } from '../lib/useAsync';
import { Card, ErrorState, InputField, LoadingBlock } from '../components/ui';
import { Section, Row } from '../components/Section';
import type { ConfirmedProfile, Preferences, StoredProfile } from '../api';
import { emptyPreferences } from '../api';
import {
  MIN_AGE, birthDateProblem, earliestBirthDate, isoDate, latestBirthDate,
} from '../lib/age';

/* ------------------------------------------------------------------ parts -- */

/** Same rule as the account menu's avatar, so one person reads as one person. */
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * The photo, and the only part of this screen that saves the instant you act.
 *
 * Everything else here is edit-then-save, because a typed field is not finished
 * until the person says it is. A picture is different: choosing the file IS the
 * decision, and making someone pick an image and then press Save invents a step
 * that has no meaning. So it uploads on choose, and removing asks nothing.
 *
 * It is also its own endpoint rather than a field on the profile save, which is
 * what lets a rejected image fail on its own without discarding the graduation
 * date someone typed next to it.
 *
 * Falls back to initials, never to a stock silhouette: an empty grey avatar
 * reads as a broken image, whereas initials read as an account.
 */
function AvatarField({
  name, url, onChanged,
}: { name: string; url: string | null; onChanged: () => void }) {
  const { t, formatNumber } = useI18n();
  const api = useApi();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) { setError(t('profile.photoWrongType')); return; }
    if (file.size > MAX_AVATAR_BYTES) { setError(t('profile.photoTooBig')); return; }
    setBusy(true);
    try {
      await api.uploadAvatar({ file });
      onChanged();
    } catch (err: unknown) {
      setError(errorText(err, { t, formatNumber }, { fallback: t('profile.photoFailed') }));
    } finally {
      setBusy(false);
      // Same file twice in a row must still fire a change event.
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.removeAvatar();
      onChanged();
    } catch (err: unknown) {
      setError(errorText(err, { t, formatNumber }, { fallback: t('profile.photoFailed') }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack stack--sm">
      <div className="avatarField">
        {url
          ? <img className="avatarField__img" src={url} alt="" width={96} height={96} />
          : <span className="avatarField__initials" aria-hidden="true">{initials(name)}</span>}

        <div className="stack stack--sm">
          <div className="row row--tight">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              <Camera size={15} aria-hidden="true" />
              {url ? t('profile.photoChange') : t('profile.photoAdd')}
            </button>
            {url && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={remove} disabled={busy}>
                <X size={15} aria-hidden="true" />
                {t('profile.photoRemove')}
              </button>
            )}
          </div>
          <p className="text-sm muted">{busy ? t('profile.photoUploading') : t('profile.photoHint')}</p>
        </div>

        {/* Hidden, driven by the labelled buttons above, so the control that is
            announced is the one that says what it does. */}
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-sm" role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- screen -- */

/** Which sections can be edited in place. Education merged into details. */
type EditKey = 'details' | 'roles';

/**
 * One entry in the missing-information box.
 *
 * The box stays HERE, whole, and that is the decision worth stating: it is the
 * screen's answer to "is my profile finished", and splitting the count across
 * two pages would leave neither able to answer it. So it still names every gap,
 * including the two whose fields now live in Settings.
 *
 * `section` is the anchor to land on and `page` is which screen carries it, so
 * naming a gap and fixing it stays ONE action across the split rather than
 * becoming a list of complaints with directions attached. `edit` is false for
 * the one gap nothing can open a form for: skills come from the documents, and
 * the honest fix is to re-read the documents.
 */
interface MissingItem {
  label: string;
  section: string;
  page: 'profile' | 'settings';
  edit: boolean;
}

export function Profile() {
  const { t, locale, formatDate } = useI18n();
  const api = useApi();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync((s) => api.getProfile(s), [api, locale]);

  const [editing, setEditing] = useState<EditKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ConfirmedProfile | null>(null);

  // The draft mirrors whatever the server last confirmed, so cancelling is a
  // reset rather than a second source of truth.
  const startEdit = useCallback((which: EditKey, p: StoredProfile) => {
    setDraft({
      fullName: p.fullName,
      birthDate: p.birthDate,
      graduationDate: p.graduationDate,
      phone: p.phone ?? null,
      skills: p.skills,
      preferences: p.preferences ?? emptyPreferences(),
      documentId: p.documentId,
    });
    setEditing(which);
  }, []);

  useEffect(() => { if (!data) setEditing(null); }, [data]);

  if (loading) return <Card><LoadingBlock rows={6} /></Card>;
  if (error) return <ErrorState onRetry={reload} />;

  // Nothing confirmed yet. Real state, not an error: a user can reach this
  // screen the moment they are onboarded but before anything was stored.
  if (!data) {
    return (
      <div className="stack stack--lg enter">
        <header>
          <h1 className="headline">{t('profile.title')}</h1>
        </header>
        <Card>
          <div className="empty">
            <p>{t('profile.empty')}</p>
            <Link className="btn btn--primary" to="/documents">{t('profile.emptyCta')}</Link>
          </div>
        </Card>
      </div>
    );
  }

  const p = data;
  const prefs: Preferences = p.preferences ?? emptyPreferences();

  /**
   * What is still missing, named so the user can act on it.
   * Phone is deliberately absent from this list: it is optional, nothing reads
   * it, and counting it would manufacture an incomplete profile out of a field
   * the product does not need.
   */
  const missing: MissingItem[] = [];
  if (!p.birthDate) missing.push({ label: t('confirm.birth'), section: 'details', page: 'profile', edit: true });
  // Graduation lives in personal details now, so both dates open one form.
  if (!p.graduationDate) missing.push({ label: t('confirm.graduation'), section: 'details', page: 'profile', edit: true });
  // Not editable anywhere on purpose: skills are read from the documents, so
  // this lands on the section and its "update documents" action rather than
  // opening a form that would let someone type a skill nothing evidences.
  if (!p.skills?.length) missing.push({ label: t('profile.skills'), section: 'skills', page: 'settings', edit: false });
  if (!prefs.preferredRole) missing.push({ label: t('profile.targetedRole'), section: 'roles', page: 'profile', edit: true });
  if (!prefs.workArrangement) missing.push({ label: t('q.workArrangement.title'), section: 'prefs', page: 'settings', edit: true });

  /**
   * Take the user to the thing they just tapped.
   *
   * Opens the section for editing where that is possible, then scrolls it into
   * view and puts the caret in its first field. The focus call is the part that
   * matters: scrolling alone leaves a keyboard or screen reader user exactly
   * where they were, having "navigated" somewhere they cannot tell they arrived
   * at. `requestAnimationFrame` because the section has to render its inputs
   * before there is anything to focus.
   */
  const goToMissing = (item: MissingItem) => {
    /* ACROSS THE SPLIT, the anchor rides in the hash rather than in router
       state. Settings reads it on arrival and does the same three things this
       branch does — open, scroll, focus — and because it is in the URL the
       landing survives a reload and can be linked to. */
    if (item.page === 'settings') {
      navigate(`/settings#sec-${item.section}`);
      return;
    }
    if (item.edit) startEdit(item.section as EditKey, p);
    requestAnimationFrame(() => {
      const el = document.getElementById(`sec-${item.section}`);
      el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      const field = el?.querySelector<HTMLElement>('input:not([type=file]), textarea');
      if (field) field.focus({ preventScroll: true });
      else el?.focus({ preventScroll: true });
    });
  };

  /**
   * The age rule, applied to whatever is in the draft right now.
   *
   * Shown under the field AND used to block the save, so the two cannot
   * disagree. `null` when the field is empty: a birth date is optional here for
   * the same reason it is optional during onboarding — nothing in the pipeline
   * reads one.
   */
  const birthProblem = draft ? birthDateProblem(draft.birthDate) : null;
  const birthError = birthProblem
    ? t(birthProblem, { min: String(MIN_AGE) })
    : undefined;

  const save = async (next: ConfirmedProfile) => {
    // A date the confirm screen would have rejected must not get in through the
    // side door. Nothing else on this screen can be invalid today.
    if (birthProblem) return;
    setSaving(true);
    try {
      await api.updateProfile(next);
      setEditing(null);
      reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack stack--lg enter">
      <header>
        <h1 className="headline">{t('profile.title')}</h1>
      </header>

      {/* Completeness first: the screen answers "am I finished" before detail. */}
      {missing.length > 0 && (
        <Card className="card--sunken">
          <div className="stack stack--sm">
            <strong>{t('profile.incomplete', { n: String(missing.length) })}</strong>
            <p className="text-sm">{t('profile.incompleteHelp')}</p>
            {/* The box is unchanged; its ITEMS are now the way to fix them.
                Real buttons, not chips with click handlers: each one moves
                focus and changes what is on screen, which is a button's job and
                is what makes it reachable by keyboard at all. */}
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              {missing.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  className="chip chip--action"
                  onClick={() => goToMissing(m)}
                >
                  {m.label}
                  <ArrowRight size={14} aria-hidden="true" className="go" />
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Personal details. Email is read only: it identifies the account, and
          the pipeline must never be able to rewrite it. */}
      <Section
        id="details"
        title={t('profile.personal')}
        icon={UserIcon}
        editing={editing === 'details'}
        onEdit={() => startEdit('details', p)}
        onCancel={() => setEditing(null)}
        onSave={() => draft && save(draft)}
        saving={saving}
      >
        {/* The photo saves on its own, so it sits outside the edit/save cycle
            and stays available whether or not the section is being edited. */}
        <AvatarField name={p.fullName || user?.fullName || ''} url={p.avatarUrl ?? null} onChanged={reload} />

        {editing === 'details' && draft ? (
          <div className="stack">
            <InputField
              label={t('confirm.name')}
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              autoComplete="name"
            />
            <InputField
              label={t('profile.phone')}
              hint={t('profile.phoneHint')}
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={draft.phone ?? ''}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value || null })}
              autoComplete="tel"
            />
            {/* Same bounds and same rule as the onboarding screen, from
                lib/age.ts. They used to exist only there, so this input would
                happily accept a date the confirm screen rejected — the age
                limit was enforced on exactly one of the two paths that set
                this field. */}
            <InputField
              label={t('confirm.birth')}
              hint={t('confirm.birthHint')}
              type="date"
              min={isoDate(earliestBirthDate())}
              max={isoDate(latestBirthDate())}
              error={birthError}
              value={draft.birthDate ?? ''}
              onChange={(e) => setDraft({ ...draft, birthDate: e.target.value || null })}
            />
            {/* Graduation came BACK here when Education was dissolved. It is
                the only field that section held, and a card carrying a single
                date between two substantial ones read as unfinished rather
                than as a category. It is edited and shown in one place, which
                is the rule that put it in its own section in the first
                place — the rule was never "a section each". */}
            <InputField
              label={t('confirm.graduation')}
              type="month"
              value={draft.graduationDate ?? ''}
              onChange={(e) => setDraft({ ...draft, graduationDate: e.target.value || null })}
            />
          </div>
        ) : (
          <div className="stack stack--sm">
            <Row label={t('confirm.name')} value={p.fullName} />
            <Row label={t('profile.email')} value={p.email ?? user?.email} />
            <Row label={t('profile.phone')} value={p.phone} />
            <Row label={t('confirm.birth')} value={p.birthDate} />
            <Row label={t('confirm.graduation')} value={p.graduationDate} />
          </div>
        )}
      </Section>

      {/* Roles: what you want, beside what the evidence says. Two separate
          things that every other product in this category collapses into one
          — and collapsing them is how a suggestion starts passing itself off
          as the user's own goal. The suggestion carries its reasoning. */}
      <Section
        id="roles"
        title={t('profile.roles')}
        icon={Target}
        editing={editing === 'roles'}
        onEdit={() => startEdit('roles', p)}
        onCancel={() => setEditing(null)}
        onSave={() => draft && save(draft)}
        saving={saving}
      >
        <div className="stack stack--sm">
          {/* Editable HERE, and nowhere else. It used to be typed in the
              preferences section below while being displayed up here as read
              only, which is the arrangement that makes a user hunt for the edit
              button belonging to the value in front of them. */}
          {editing === 'roles' && draft ? (
            <InputField
              label={t('profile.targetedRole')}
              hint={t('q.preferredRole.help')}
              placeholder={t('q.preferredRole.placeholder')}
              value={draft.preferences.preferredRole}
              onChange={(e) => setDraft({
                ...draft,
                preferences: { ...draft.preferences, preferredRole: e.target.value },
              })}
            />
          ) : (
            <Row label={t('profile.targetedRole')} value={prefs.preferredRole} />
          )}
          {/* The agents' suggestion stays read only whatever happens: it is
              what the documents imply, not something the user gets to set. */}
          <div className="profile__row">
            <span className="profile__label">{t('profile.suggestedRole')}</span>
            <span className={p.suggestedRole ? 'profile__value' : 'profile__value profile__value--missing'}>
              {p.suggestedRole ? p.suggestedRole.title : t('profile.suggestedRoleNone')}
            </span>
          </div>
          {p.suggestedRole?.why && (
            <div className="why">
              <p className="why__head">{t('profile.suggestedRoleWhy')}</p>
              <p>{p.suggestedRole.why}</p>
            </div>
          )}
        </div>
      </Section>

      {/* CONTACT. A heading, an address and a number. It previously carried a
          sentence explaining what you might write to them about, which told a
          person who had found the contact section what contact is for. */}
      <Section id="contact" title={t('profile.contactTitle')} icon={Mail} editing={false}>
        <div className="stack stack--sm">
          <p className="row profile__contact">
            <Mail size={16} aria-hidden="true" />
            <a href={`mailto:${contact.email}`}><bdi>{contact.email}</bdi></a>
          </p>
          <p className="row profile__contact">
            <Phone size={16} aria-hidden="true" />
            {/* A telephone number is a numeric axis and never mirrors, so it is
                isolated in both directions rather than only under RTL. */}
            <a href={`tel:${contact.phoneHref}`} dir="ltr"><bdi>{contact.phone}</bdi></a>
          </p>
        </div>
      </Section>

      {p.updatedAt && (
        <p className="text-sm muted">
          {t('profile.lastUpdated', { date: formatDate(new Date(p.updatedAt).toISOString()) })}
        </p>
      )}
    </div>
  );
}
