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
  Camera, Check, FileText, GraduationCap, Pencil, Sparkles, Target,
  User as UserIcon, X,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { useApi } from '../state/api';
import { useAuth } from '../state/auth';
import { useAsync } from '../lib/useAsync';
import {
  Button, Card, Chip, ErrorState, InputField, LoadingBlock,
} from '../components/ui';
import type { ConfirmedProfile, Preferences, StoredProfile } from '../api';
import { emptyPreferences } from '../api';

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
  title, icon: Icon, editing, onEdit, onCancel, onSave, saving, children,
}: {
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
    <Card>
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

export function Profile() {
  const { t, locale, formatDate } = useI18n();
  const api = useApi();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync((s) => api.getProfile(s), [api, locale]);

  const [editing, setEditing] = useState<'details' | 'prefs' | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ConfirmedProfile | null>(null);

  // The draft mirrors whatever the server last confirmed, so cancelling is a
  // reset rather than a second source of truth.
  const startEdit = useCallback((which: 'details' | 'prefs', p: StoredProfile) => {
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
        <header className="stack stack--sm">
          <h1 className="headline">{t('profile.title')}</h1>
          <p className="subhead">{t('profile.sub')}</p>
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
  const missing: string[] = [];
  if (!p.birthDate) missing.push(t('confirm.birth'));
  if (!p.graduationDate) missing.push(t('confirm.graduation'));
  if (!p.skills?.length) missing.push(t('profile.skills'));
  if (!prefs.preferredRole) missing.push(t('q.preferredRole.title'));
  if (!prefs.workArrangement) missing.push(t('q.workArrangement.title'));

  const save = async (next: ConfirmedProfile) => {
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
      <header className="stack stack--sm">
        <h1 className="headline">{t('profile.title')}</h1>
        <p className="subhead">{t('profile.sub')}</p>
      </header>

      {/* Completeness first: the screen answers "am I finished" before detail. */}
      {missing.length > 0 && (
        <Card className="card--sunken">
          <div className="stack stack--sm">
            <strong>{t('profile.incomplete', { n: String(missing.length) })}</strong>
            <p className="text-sm">{t('profile.incompleteHelp')}</p>
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              {missing.map((m) => <Chip key={m}>{m}</Chip>)}
            </div>
          </div>
        </Card>
      )}

      {/* Personal details. Email is read only: it identifies the account, and
          the pipeline must never be able to rewrite it. */}
      <Section
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
            <InputField
              label={t('confirm.birth')}
              type="date"
              value={draft.birthDate ?? ''}
              onChange={(e) => setDraft({ ...draft, birthDate: e.target.value || null })}
            />
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
          </div>
        )}
      </Section>

      {/* Roles: what you want, beside what the evidence says. Two separate
          things that every other product in this category collapses into one
          — and collapsing them is how a suggestion starts passing itself off
          as the user's own goal. The suggestion carries its reasoning. */}
      <Section title={t('profile.roles')} icon={Target} editing={false}>
        <div className="stack stack--sm">
          <Row label={t('profile.targetedRole')} value={prefs.preferredRole} />
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
          the section holds exactly that rather than inventing a history. */}
      <Section title={t('profile.education')} icon={GraduationCap} editing={false}>
        <div className="stack stack--sm">
          <Row label={t('confirm.graduation')} value={p.graduationDate} />
        </div>
      </Section>

      {/* Skills, read only here on purpose: they come from the documents, and
          the honest way to change them is to re-read the documents. */}
      <Section title={t('profile.skills')} icon={Sparkles} editing={false}>
        <div className="stack stack--sm">
          {p.skills?.length ? (
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              {p.skills.map((skill) => <Chip key={skill}>{skill}</Chip>)}
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
      <Section title={t('profile.documents')} icon={FileText} editing={false}>
        <div className="stack stack--sm">
          {p.documents?.length ? (
            <ul className="stack stack--sm">
              {p.documents.map((d) => (
                <li key={d.id} className="profile__row">
                  <span className="profile__label">{t(`doc.${d.kind}`)}</span>
                  <span className="profile__value"><bdi>{d.fileName}</bdi></span>
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
            <InputField
              label={t('q.preferredRole.label')}
              value={draft.preferences.preferredRole}
              onChange={(e) => setDraft({
                ...draft,
                preferences: { ...draft.preferences, preferredRole: e.target.value },
              })}
              placeholder={t('q.preferredRole.placeholder')}
            />
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
            <Row label={t('q.preferredRole.title')} value={prefs.preferredRole} />
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
