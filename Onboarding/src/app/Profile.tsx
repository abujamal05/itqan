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
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, FileText, GraduationCap, Pencil, Sparkles, User as UserIcon, X,
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

  /** What is still missing, named so the user can act on it. */
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
        {editing === 'details' && draft ? (
          <div className="stack">
            <InputField
              label={t('confirm.name')}
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              autoComplete="name"
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
            <Row label={t('confirm.birth')} value={p.birthDate} />
          </div>
        )}
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
          <div className="row">
            <Link className="btn btn--secondary" to="/documents">{t('profile.updateDocs')}</Link>
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
