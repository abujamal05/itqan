/**
 * Profile — one place to see and correct everything Itqan holds about you.
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
import { Link } from 'react-router-dom';
import {
  ArrowRight, Camera, Check, FileText, GraduationCap, Pencil, Sparkles, Target,
  User as UserIcon, X,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { skillCase } from '../lib/skillCase';
import { useApi } from '../state/api';
import { useAuth } from '../state/auth';
import { useAsync } from '../lib/useAsync';
import {
  Button, Card, Chip, ErrorState, InputField, LoadingBlock,
} from '../components/ui';
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

/**
 * A section that flips between reading and editing. The heading, the edit
 * control and the saved state all live here so no section has to re-implement
 * them and drift.
 */
function Section({
  id, title, icon: Icon, editing, onEdit, onCancel, onSave, saving, children,
}: {
  /** Anchors the section so the missing-information box can send you to it. */
  id: string;
  title: string;
  icon: typeof UserIcon;
  editing: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  saving?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Card id={`sec-${id}`}>
      <div className="stack">
        <div className="section__head">
          <h2 className="section__title">
            <Icon size={18} aria-hidden="true" className="profile__icon" />
            {title}
          </h2>
          <span className="spacer" />
          {onEdit && !editing && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onEdit}>
              <Pencil size={15} aria-hidden="true" />
              {t('profile.edit')}
            </button>
          )}
        </div>

        {children}

        {editing && (
          <div className="row">
            <Button onClick={onSave} loading={saving}>
              <Check size={16} aria-hidden="true" />
              {t('profile.save')}
            </Button>
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
              <X size={16} aria-hidden="true" />
              {t('action.cancel')}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
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
  const { t } = useI18n();
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
    } catch {
      setError(t('profile.photoFailed'));
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
    } catch {
      setError(t('profile.photoFailed'));
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

/** One read only row. Missing values say so rather than rendering blank. */
function Row({ label, value }: { label: string; value: string | null | undefined }) {
  const { t } = useI18n();
  const missing = value == null || value === '';
  return (
    <div className="profile__row">
      <span className="profile__label">{label}</span>
      <span className={missing ? 'profile__value profile__value--missing' : 'profile__value'}>
        {missing ? t('profile.notSet') : value}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- screen -- */

/** Which sections can be edited in place. */
type EditKey = 'details' | 'roles' | 'education' | 'prefs';

/**
 * One entry in the missing-information box.
 *
 * The box itself is unchanged by request — same card, same wording, same place.
 * What changed is that its items now know where they live, so naming a gap and
 * fixing it are one action instead of two. `section` is where the value is
 * edited; `edit` is false for the one gap that is not editable here, because
 * skills come from the documents and the honest fix is to re-read them.
 */
interface MissingItem {
  label: string;
  section: EditKey | 'skills';
  edit: boolean;
}

export function Profile() {
  const { t, locale, formatDate } = useI18n();
  const api = useApi();
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
  if (!p.birthDate) missing.push({ label: t('confirm.birth'), section: 'details', edit: true });
  if (!p.graduationDate) missing.push({ label: t('confirm.graduation'), section: 'education', edit: true });
  // Not editable here on purpose: skills are read from the documents, so the
  // link goes to the section and its "update documents" action rather than
  // opening a form that would let someone type a skill nothing evidences.
  if (!p.skills?.length) missing.push({ label: t('profile.skills'), section: 'skills', edit: false });
  if (!prefs.preferredRole) missing.push({ label: t('profile.targetedRole'), section: 'roles', edit: true });
  if (!prefs.workArrangement) missing.push({ label: t('q.workArrangement.title'), section: 'prefs', edit: true });

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

  const prefLabel = (key: keyof Preferences, value: string | null) =>
    (value ? t(`q.${key}.opt.${value}`) : null);

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
            {/* Graduation moved to its own section. It was edited here AND
                displayed there, so the same value had two homes and only one
                of them had a way to change it. */}
          </div>
        ) : (
          <div className="stack stack--sm">
            <Row label={t('confirm.name')} value={p.fullName} />
            <Row label={t('profile.email')} value={p.email ?? user?.email} />
            <Row label={t('profile.phone')} value={p.phone} />
            <Row label={t('confirm.birth')} value={p.birthDate} />
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

      {/* Education. Graduation is the only field the pipeline reads today, so
          the section holds exactly that rather than inventing a history — and
          it is now editable here, where it is shown, instead of inside the
          personal details form two sections up. */}
      <Section
        id="education"
        title={t('profile.education')}
        icon={GraduationCap}
        editing={editing === 'education'}
        onEdit={() => startEdit('education', p)}
        onCancel={() => setEditing(null)}
        onSave={() => draft && save(draft)}
        saving={saving}
      >
        <div className="stack stack--sm">
          {editing === 'education' && draft ? (
            <InputField
              label={t('confirm.graduation')}
              type="month"
              value={draft.graduationDate ?? ''}
              onChange={(e) => setDraft({ ...draft, graduationDate: e.target.value || null })}
            />
          ) : (
            <Row label={t('confirm.graduation')} value={p.graduationDate} />
          )}
        </div>
      </Section>

      {/* Skills, read only here on purpose: they come from the documents, and
          the honest way to change them is to re-read the documents. */}
      <Section id="skills" title={t('profile.skills')} icon={Sparkles} editing={false}>
        <div className="stack stack--sm">
          {p.skills?.length ? (
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              {p.skills.map((skill) => <Chip key={skill}>{skillCase(skill)}</Chip>)}
            </div>
          ) : (
            <p className="text-sm muted">{t('profile.noSkills')}</p>
          )}
          <p className="text-sm muted">{t('profile.skillsFromDocs')}</p>
          <div className="row">
            <Link className="btn btn--secondary" to="/documents">{t('profile.updateDocs')}</Link>
          </div>
        </div>
      </Section>

      {/* Documents. */}
      <Section id="documents" title={t('profile.documents')} icon={FileText} editing={false}>
        <div className="stack stack--sm">
          {p.documents?.length ? (
            <ul className="stack stack--sm">
              {p.documents.map((d) => (
                <li key={d.id} className="profile__row">
                  <span className="profile__label">{t(`doc.${d.kind}`)}</span>
                  <span className="profile__value"><bdi>{d.fileName}</bdi></span>
                  <DeleteDocument id={d.id} onDeleted={reload} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm muted">{t('profile.noDocuments')}</p>
          )}
          {/* Says the consequence before the action, not after it. Replacing a
              document re-runs the pipeline and rewrites the skills, courses and
              matches this person may have spent time reading — that is worth
              knowing before the click, not on the next screen. */}
          {/* NOT `muted`. This warns that an action will rewrite results the
              user may have spent time reading; demoting it to the same weight
              as an empty-state placeholder was a regression from a dashboard
              change that never looked at this screen. */}
          <p className="text-sm">{t('profile.docsRereads')}</p>
          <div className="row">
            <Link className="btn btn--secondary" to="/documents">{t('profile.docsReplace')}</Link>
          </div>
        </div>
      </Section>

      {/* Preferences: the four onboarding answers, editable because they are
          the user's opinion rather than an extraction. */}
      <Section
        id="prefs"
        title={t('profile.preferences')}
        icon={Sparkles}
        editing={editing === 'prefs'}
        onEdit={() => startEdit('prefs', p)}
        onCancel={() => setEditing(null)}
        onSave={() => draft && save(draft)}
        saving={saving}
      >
        {editing === 'prefs' && draft ? (
          <div className="stack">
            {/* The role is edited in the Roles section, which is also where it
                is shown. Two editors for one string is how the two drift. */}
            {(['coursePricing', 'workArrangement', 'openToOtherRoles'] as const).map((key) => (
              <div className="field" key={key}>
                <span className="field__label">{t(`q.${key}.title`)}</span>
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  {(key === 'coursePricing' ? ['free', 'any']
                    : key === 'workArrangement' ? ['remote', 'hybrid', 'onsite']
                      : ['yes', 'no']).map((opt) => (
                        <Chip
                          key={opt}
                          selected={draft.preferences[key] === opt}
                          onToggle={() => setDraft({
                            ...draft,
                            preferences: { ...draft.preferences, [key]: opt } as Preferences,
                          })}
                        >
                          {t(`q.${key}.opt.${opt}`)}
                        </Chip>
                      ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="stack stack--sm">
            <Row label={t('q.workArrangement.title')} value={prefLabel('workArrangement', prefs.workArrangement)} />
            <Row label={t('q.coursePricing.title')} value={prefLabel('coursePricing', prefs.coursePricing)} />
            <Row label={t('q.openToOtherRoles.title')} value={prefLabel('openToOtherRoles', prefs.openToOtherRoles)} />
          </div>
        )}
      </Section>

      {p.updatedAt && (
        <p className="text-sm muted">
          {t('profile.lastUpdated', { date: formatDate(new Date(p.updatedAt).toISOString()) })}
        </p>
      )}
    </div>
  );
}


/**
 * Remove one document, from the list and from the server's disk.
 *
 * TWO TAPS, not one, and this is a deliberate reading of "an X that deletes it".
 * The file is somebody's CV, the delete is irreversible, and the control sits in
 * a row they are otherwise only reading — so a mis-tap would destroy something
 * they cannot get back without finding the original again.
 *
 * It is still one control and no dialog: the X becomes a short confirm in place,
 * and moving the pointer away puts it back. That costs a deliberate user one
 * extra tap and saves an accidental one entirely.
 */
function DeleteDocument({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const { t } = useI18n();
  const api = useApi();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (busy) return <span className="text-sm muted">{t('profile.doc.removing')}</span>;

  if (confirming) {
    return (
      <span className="doc-remove">
        <button
          type="button"
          className="doc-remove__yes"
          onClick={async () => {
            setBusy(true);
            try {
              await api.deleteDocument(id);
              onDeleted();
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('profile.doc.removeConfirm')}
        </button>
        <button type="button" className="doc-remove__no" onClick={() => setConfirming(false)}>
          {t('action.cancel')}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="doc-remove__x"
      aria-label={t('profile.doc.remove')}
      title={t('profile.doc.remove')}
      onClick={() => setConfirming(true)}
    >
      <X size={16} aria-hidden="true" />
    </button>
  );
}
