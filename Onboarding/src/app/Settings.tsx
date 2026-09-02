/**
 * Settings — everything about your account that is not who you are.
 *
 * THE SPLIT. Profile answers "is this me, and is it right": your details, your
 * photo, the role you are working towards, and how to reach Itqan. Settings
 * holds what the product HOLDS and what it DOES with it: the skills it read,
 * the documents it read them from, the AI allowance it spends on you, the
 * preferences it matches against, where to get help, and how to stop. One
 * screen had grown to eight sections and a person hunting for their document
 * list was scrolling past their own birth date to find it.
 *
 * IT IS THE SAME SCREEN TO LOOK AT. Both pages compose `<Section>` and `<Row>`
 * from `components/Section.tsx` — the Profile screen's own parts, lifted out
 * rather than reimplemented, so the split is a change of address and not a
 * change of design. Workspace register throughout, per DESIGN.md §3.3.
 *
 * ARRIVING FROM A GAP. Profile's missing-information box still names every gap,
 * including the two that now live here, and its buttons link across with the
 * section's anchor in the hash. That hash is honoured below: the section opens
 * for editing if it can be edited, scrolls into view, and takes focus. A named
 * gap that costs a second screen of hunting is a list of complaints.
 *
 * Hud is absent, for the same reason he is absent from Profile: the brand
 * fences the mascot away from anything that reads as a record of the user.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bot, FileText, LifeBuoy, Mail, Phone, Plus, ScrollText, Shield, Sparkles, X,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { useUpdate } from '../state/update';
import { skillCase } from '../lib/skillCase';
import { contact } from '../lib/contact';
import { SITE_ORIGIN } from '../lib/site';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { Card, Chip, ErrorState, LoadingBlock } from '../components/ui';
import { Section, Row } from '../components/Section';
import { UsageMeters } from '../components/UsageMeters';
import { CloseAccount } from '../components/CloseAccount';
import { ClearSkills } from '../components/ClearSkills';
import { DocumentManager } from '../components/DocumentManager';
import type { ConfirmedProfile, Preferences, StoredProfile, Usage } from '../api';
import { emptyPreferences } from '../api';

/** Which sections can be edited in place. Named, so the hash can open them. */
type EditKey = 'prefs' | 'skills';

export function Settings() {
  const { t, locale } = useI18n();
  const api = useApi();
  const { hash } = useLocation();
  /* Editing a skill makes the matches stale, and the person is told so rather
     than left with a course path built from what they just corrected. */
  const { refresh: refreshUpdate } = useUpdate();
  const [newSkill, setNewSkill] = useState('');
  const { data, loading, error, reload } = useAsync((s) => api.getProfile(s), [api, locale]);

  /**
   * The AI allowance. Its own request and its own failure, exactly as it was on
   * Profile: `GET /api/usage` does not exist in production yet (BACKEND.md §4)
   * and a 404 there must not take this screen down with it.
   *
   * Three states, not two. Rendering nothing when the call fails makes a broken
   * section indistinguishable from an absent one, which cost real time working
   * out which. It says the usage is unavailable instead. Still no zeros: an
   * invented figure is worse than an admitted gap.
   */
  const [usage, setUsage] = useState<Usage | 'unavailable' | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    api.getUsage(ac.signal)
      .then(setUsage)
      .catch(() => { if (!ac.signal.aborted) setUsage('unavailable'); });
    return () => ac.abort();
  }, [api, locale]);

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

  /**
   * Land on the section the other screen sent us to.
   *
   * Runs once the data is in, because there is nothing to scroll to before the
   * sections render. `requestAnimationFrame` for the same reason one step
   * further in: an editable section has to have rendered its inputs before
   * there is a field to focus. Focus is the part that matters — scrolling alone
   * leaves a keyboard or screen reader user exactly where they were, having
   * "navigated" somewhere they cannot tell they arrived at.
   */
  useEffect(() => {
    if (!data || !hash.startsWith('#sec-')) return;
    const key = hash.slice('#sec-'.length);
    if (key === 'prefs' || key === 'skills') startEdit(key, data);
    const id = requestAnimationFrame(() => {
      const el = document.getElementById(`sec-${key}`);
      if (!el) return;
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      const field = el.querySelector<HTMLElement>('input:not([type=file]), textarea, button');
      (field ?? el).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [data, hash, startEdit]);

  if (loading) return <Card><LoadingBlock rows={6} /></Card>;
  if (error) return <ErrorState onRetry={reload} />;

  const header = (
    <header>
      <h1 className="headline">{t('settings.title')}</h1>
    </header>
  );

  /**
   * Nothing confirmed yet. Real state, not an error — someone can reach this
   * screen the moment they are onboarded and before anything was stored.
   *
   * CLOSING THE ACCOUNT STILL RENDERS. It is the one thing on this page that
   * does not depend on there being a profile, and it is the one thing a person
   * who wants out must not have to produce a CV to reach.
   */
  if (!data) {
    return (
      <div className="stack stack--lg enter">
        {header}
        <Card>
          <div className="empty">
            <p>{t('profile.empty')}</p>
            <Link className="btn btn--primary" to="/documents">{t('profile.emptyCta')}</Link>
          </div>
        </Card>
        <CloseAccount usage={usage} />
      </div>
    );
  }

  const p = data;
  const prefs: Preferences = p.preferences ?? emptyPreferences();

  const save = async (next: ConfirmedProfile) => {
    setSaving(true);
    try {
      await api.updateProfile(next);
      setEditing(null);
      reload();
      /* The server decides whether that actually made anything stale — this
         only asks the question again. Assuming a save always needs a run would
         put a paid offer in front of somebody who changed their mind about
         remote work. */
      refreshUpdate();
    } finally {
      setSaving(false);
    }
  };

  const prefLabel = (key: keyof Preferences, value: string | null) =>
    (value ? t(`q.${key}.opt.${value}`) : null);

  return (
    <div className="stack stack--lg enter">
      {header}

      {/* ---- Skills ---------------------------------------------------------
          EDITABLE NOW, and the reason it was not is worth keeping in view: the
          skills come from the documents, and a screen that let someone type a
          skill nothing evidences would be putting an unevidenced claim into the
          thing this product's whole argument rests on.

          What changed is that the same editing already exists in onboarding, on
          the confirmation screen, where correcting a misread skill is the
          product's first trust moment. Refusing it afterwards said the person
          could be trusted to correct an extraction on Tuesday and not on
          Wednesday. So it is the same act, in the same shape, and the honest
          part is preserved: a correction makes the matches stale, and the
          prompt that follows says so and prices the rerun. */}
      <Section
        id="skills"
        title={t('profile.skills')}
        icon={Sparkles}
        editing={editing === 'skills'}
        onEdit={() => startEdit('skills', p)}
        onCancel={() => setEditing(null)}
        onSave={() => draft && save(draft)}
        saving={saving}
      >
        {editing === 'skills' && draft ? (
          <div className="stack stack--sm">
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              {draft.skills.map((skill) => (
                <span key={skill} className="chip chip--capability chip--removable">
                  {skillCase(skill)}
                  <button
                    type="button"
                    className="chip__x"
                    aria-label={`${t('action.remove')}: ${skillCase(skill)}`}
                    onClick={() => setDraft({
                      ...draft,
                      skills: draft.skills.filter((x) => x !== skill),
                    })}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>

            {/* A form, so Enter submits the field rather than the section. The
                same add-one-at-a-time shape the confirmation screen uses. */}
            <form
              className="row"
              style={{ gap: 'var(--space-2)' }}
              onSubmit={(e) => {
                e.preventDefault();
                const name = newSkill.trim();
                if (!name) return;
                /* Case insensitive, because "SQL" and "sql" are one skill and
                   two chips saying so is a list that looks careless. */
                if (!draft.skills.some((x) => x.toLowerCase() === name.toLowerCase())) {
                  setDraft({ ...draft, skills: [...draft.skills, name] });
                }
                setNewSkill('');
              }}
            >
              <input
                className="input"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder={t('confirm.addSkillPlaceholder')}
                aria-label={t('confirm.addSkill')}
                style={{ flex: '1 1 12rem', minInlineSize: 0 }}
              />
              <button type="submit" className="btn btn--secondary" disabled={!newSkill.trim()}>
                <Plus size={16} aria-hidden="true" />
                {t('action.add')}
              </button>
            </form>

            <p className="text-sm muted">{t('skills.editNote')}</p>
          </div>
        ) : (
          <div className="stack stack--sm">
            {p.skills?.length ? (
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {p.skills.map((skill) => <Chip key={skill}>{skillCase(skill)}</Chip>)}
              </div>
            ) : (
              <p className="text-sm muted">{t('profile.noSkills')}</p>
            )}
            <p className="text-sm muted">{t('profile.skillsFromDocs')}</p>
          </div>
        )}
      </Section>

      {/* ---- Documents ------------------------------------------------------
          MANAGEMENT, NOT A LIST. Every document can have its file swapped and
          its category corrected in place; the CV is the one that cannot be
          removed and cannot be duplicated, so it is replaced instead. See
          `DocumentManager` for the two halves of that rule.

          The client rules are a courtesy. The server enforces both — the last
          CV and the only CV — because a stale build of this app is not a way in.
          BACKEND.md §3. */}
      <Section id="documents" title={t('profile.documents')} icon={FileText} editing={false}>
        <div className="stack stack--sm">
          {/* `refreshUpdate` alongside the reload, because every act in that
              list changes what Itqan is working from: a replaced file, a
              recategorised one, a removed one. The server decides whether any
              of them actually made something stale; this only asks. */}
          <DocumentManager
            documents={p.documents ?? []}
            onChanged={() => { reload(); refreshUpdate(); }}
          />

          <p className="text-sm">{t('profile.docsCvRequired')}</p>

          {/* THE OTHER DOOR, and it is a different act. Managing a document
              here changes what Itqan holds; reading it again is an extraction
              that spends tokens and ends at a screen where the person checks
              what was read. Naming that plainly is what stops someone
              replacing a CV and wondering why their skills did not move. */}
          <p className="text-sm">{t('docs.rereadNote')}</p>
          <div className="row">
            <Link className="btn btn--secondary" to="/documents">{t('docs.rereadCta')}</Link>
          </div>
        </div>
      </Section>

      {/* ---- AI usage --------------------------------------------------------
          THEIR consumption, not the price list. What each tier includes is
          general information and belongs on a page of its own; what belongs
          here is the one thing only this screen can tell them — how much of
          their own allowance is left, and when it comes back. */}
      {usage && (
        <Section id="ai" title={t('profile.aiTitle')} icon={Bot} editing={false}>
          {usage === 'unavailable'
            ? <p className="text-sm muted">{t('profile.aiUsageUnavailable')}</p>
            : <UsageMeters usage={usage} />}

          {/* The comparison lives on its own page. A price list beside someone's
              own consumption turns a settings screen into a sales screen. */}
          <div className="row">
            <Link className="btn btn--secondary" to="/plan">{t('nav.plan')}</Link>
          </div>
        </Section>
      )}

      {/* Preferences: the onboarding answers, editable because they are the
          user's opinion rather than an extraction. The role they are working
          towards is NOT here — it is edited on Profile, where it is shown, and
          two editors for one string is how the two drift. */}
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

      {/* ---- Support ---------------------------------------------------------
          The same address and number Profile carries, plus the two documents a
          person is most likely to be looking for when they open a settings
          screen. Both are written in full and live on the site (LEGAL-BRIEF.md,
          2026-08-24), so these are real destinations rather than placeholders.
          They open in a new tab: the app is a session, and sending someone out
          of it to read a policy would cost them their place. */}
      <Section id="support" title={t('settings.supportTitle')} icon={LifeBuoy} editing={false}>
        <div className="stack stack--sm">
          <p className="text-sm">{t('settings.supportBody')}</p>
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

          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <a
              className="btn btn--secondary btn--sm"
              href={`${SITE_ORIGIN}/${locale}/privacy/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Shield size={15} aria-hidden="true" />
              {t('settings.privacy')}
            </a>
            <a
              className="btn btn--secondary btn--sm"
              href={`${SITE_ORIGIN}/${locale}/terms/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ScrollText size={15} aria-hidden="true" />
              {t('settings.terms')}
            </a>
          </div>
        </div>
      </Section>

      {/* Last, and deliberately so. Nothing follows the way out.
          `usage` is HANDED DOWN rather than fetched again: this screen already
          has it, and the account-closing card needs it only to know whether a
          subscription is still renewing. A second request for the same payload
          would also be a second chance for the two copies to disagree about
          whether deletion is allowed. */}
      {/* Before the account card, and after everything that manages a document.
          The order is the size of the act: correct a file, then delete what was
          read out of your files, then close the account. `refreshUpdate` runs
          with the reload for the same reason the document controls do — the
          skills are gone, so what Itqan is working from has changed and the
          server decides whether that leaves anything stale. */}
      <ClearSkills
        count={p.skills?.length}
        onCleared={() => { reload(); refreshUpdate(); }}
      />

      <CloseAccount usage={usage} />
    </div>
  );
}
