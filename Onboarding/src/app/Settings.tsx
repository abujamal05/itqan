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
  Bot, FileText, LifeBuoy, Mail, Phone, ScrollText, Shield, Sparkles,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { skillCase } from '../lib/skillCase';
import { contact } from '../lib/contact';
import { fileSize } from '../lib/fileSize';
import { SITE_ORIGIN } from '../lib/site';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { Card, Chip, ErrorState, LoadingBlock } from '../components/ui';
import { Section, Row } from '../components/Section';
import { UsageMeters } from '../components/UsageMeters';
import { CloseAccount } from '../components/CloseAccount';
import { DeleteDocument } from '../components/DeleteDocument';
import type { ConfirmedProfile, Preferences, StoredProfile, Usage } from '../api';
import { emptyPreferences, REQUIRED_KIND } from '../api';

/** The only section here that is editable. Named, so the hash can open it. */
type EditKey = 'prefs';

export function Settings() {
  const { t, locale, formatNumber } = useI18n();
  const api = useApi();
  const { hash } = useLocation();
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
    if (key === 'prefs') startEdit('prefs', data);
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
        <CloseAccount />
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
    } finally {
      setSaving(false);
    }
  };

  const prefLabel = (key: keyof Preferences, value: string | null) =>
    (value ? t(`q.${key}.opt.${value}`) : null);

  return (
    <div className="stack stack--lg enter">
      {header}

      {/* Skills, read only on purpose: they come from the documents, and the
          honest way to change them is to re-read the documents. */}
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

      {/* ---- Documents ------------------------------------------------------
          The CV is the one document the pipeline cannot run without, so the
          LAST one cannot be removed. It is replaced instead, which is what the
          button below does.

          The protected row shows a "Required" tag WHERE the remove control
          would have been, rather than a disabled X. A blocked control invites a
          click and then refuses it; a label answers "why can I not remove this"
          before the question is asked. A second CV makes the first deletable
          again, and both rows get their control back.

          The client rule is a courtesy. The server must enforce it too — see
          BACKEND.md §3 — because a stale build of this app is not a way in. */}
      <Section id="documents" title={t('profile.documents')} icon={FileText} editing={false}>
        <div className="stack stack--sm">
          {p.documents?.length ? (
            <ul className="doclist">
              {p.documents.map((d) => {
                /* Counted over the WHOLE list, not this row: what protects a CV
                   is being the only one, and that is a fact about the set. */
                const lastCv = d.kind === REQUIRED_KIND
                  && p.documents.filter((o) => o.kind === REQUIRED_KIND).length === 1;

                return (
                  <li key={d.id} className="doclist__item">
                    <FileText size={16} className="doclist__icon" aria-hidden="true" />
                    <span className="doclist__main">
                      <span className="doclist__name"><bdi>{d.fileName}</bdi></span>
                      <span className="doclist__meta">
                        {t(`doc.${d.kind}`)}
                        {Number.isFinite(d.sizeBytes) && d.sizeBytes > 0 && (
                          <> · <span className="num">{fileSize(d.sizeBytes, t, formatNumber)}</span></>
                        )}
                      </span>
                    </span>

                    {lastCv
                      ? <span className="doclist__tag">{t('profile.docRequired')}</span>
                      : <DeleteDocument id={d.id} onDeleted={reload} />}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm muted">{t('profile.noDocuments')}</p>
          )}

          <p className="text-sm">{t('profile.docsCvRequired')}</p>

          {/* Says the consequence before the action, not after it. Replacing a
              document re-runs the pipeline and rewrites the skills, courses and
              matches this person may have spent time reading — that is worth
              knowing before the click. NOT `muted`: demoting a warning to the
              weight of an empty-state placeholder was a regression once. */}
          <p className="text-sm">{t('profile.docsRereads')}</p>
          <div className="row">
            <Link className="btn btn--secondary" to="/documents">{t('profile.docsReplace')}</Link>
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

      {/* Last, and deliberately so. Nothing follows the way out. */}
      <CloseAccount />
    </div>
  );
}
