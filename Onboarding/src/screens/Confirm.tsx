/**
 * Screen 4 — confirm what was read. New screen, requested, and the most
 * important one in the flow.
 *
 * Why it exists: four agents run in sequence and their errors compound, so a
 * clean looking answer downstream can be wrong in ways nobody can see. A human
 * checkpoint before anything is used is the difference between a product that
 * is 85% right and shows its working, and one that is 95% right and cannot be
 * checked. The first is worth more here.
 *
 * HUD IS DELIBERATELY ABSENT. The brand locks the mascot out of the
 * confirmation screen: a cartoon bird beside data the user is about to certify
 * reframes evidence as a cute guess. This is the one screen where that would
 * cost the most.
 *
 * It also carries the consent control, in the open, because this is the first
 * moment the user has actually seen what the product extracted about them.
 * Consent asked before they know what was read is not informed consent.
 *
 * Five states, all handled: loading (pipeline still running), error/manual
 * (nothing to show, fields start blank), partial (low confidence items flagged
 * for review), ideal (clean parse), and empty skills.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, FileText, HelpCircle, Plus, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { useOnboarding } from '../state/onboarding';
import { useApi } from '../state/api';
import { useAuth } from '../state/auth';
import { isStrong } from '../api';
import type { Skill } from '../api';
import { Button, Callout, Card, LoadingBlock } from '../components/ui';
import { PipelineProgress } from '../components/PipelineProgress';
import { SiteHeader } from '../components/SiteHeader';

interface Draft {
  name: string;
  birth: string;
  graduation: string;
  skills: Skill[];
}

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function Confirm() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const api = useApi();
  // Flips the account's onboarded flag so the guards stop routing back here.
  const { markOnboarded: onDone } = useAuth();
  const { analysis, entry, ready, failed, preferences, documents, completeProfile } = useOnboarding();

  /**
   * Whatever the stage, if the extraction is here, show it.
   *
   * This used to be `analysis?.stage === 'done' ? analysis.result : undefined`,
   * and `done` meant all three agents had finished — so this screen sat on a
   * skeleton for around three minutes waiting for a course recommender whose
   * output it does not display. Agent A's extraction is the only thing being
   * confirmed here, and the run now pauses precisely so it can be shown the
   * moment it exists.
   */
  const result = analysis?.result;
  /**
   * `!failed` matters as much as `!ready`.
   *
   * A failed run has no result, so a check on readiness alone left this screen
   * showing a skeleton forever on the one path that most needs to move on — the
   * document could not be read, and the answer is to let the user type their
   * details in. The heading already switches to the manual wording; the body has
   * to follow it.
   */
  const waiting = entry === 'document' && !ready && !failed;

  /**
   * A graduation date the document gave us as a YEAR, with no month.
   *
   * The field is `<input type="month">`, which can only hold `yyyy-mm`, so a bare
   * year silently renders as an empty box — under a "suggested, confirm" badge
   * referring to a value the user cannot see. Rather than pad it to January, which
   * would state a month the document never did, the year is shown and the user is
   * asked for the month.
   */
  const gradYearOnly = /^\d{4}$/.test(result?.graduationDate?.value ?? '')
    ? result!.graduationDate!.value : null;

  const [draft, setDraft] = useState<Draft>({ name: '', birth: '', graduation: '', skills: [] });
  const [seeded, setSeeded] = useState(false);
  const [consent, setConsent] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  // Seed once, when (and if) the reading lands. A later re-render must never
  // overwrite something the user has already corrected.
  useEffect(() => {
    if (seeded || !result) return;
    setDraft({
      name: result.fullName?.value ?? '',
      birth: result.birthDate?.value ?? '',
      graduation: result.graduationDate?.value ?? '',
      skills: result.skills,
    });
    setSeeded(true);
  }, [result, seeded]);

  const uncertain = useMemo(() => {
    if (!result) return [] as string[];
    const list: string[] = [];
    if (result.fullName && !isStrong(result.fullName.confidence)) list.push(t('confirm.name'));
    if (result.birthDate && !isStrong(result.birthDate.confidence)) list.push(t('confirm.birth'));
    if (result.graduationDate && !isStrong(result.graduationDate.confidence)) list.push(t('confirm.graduation'));
    if (result.skills.some((s) => !isStrong(s.confidence))) list.push(t('confirm.skills'));
    return list;
  }, [result, t]);

  /* -------------------------------------------------------- validation -- */
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = t('confirm.errName');
    if (draft.birth) {
      const d = new Date(draft.birth);
      if (d > today) e.birth = t('confirm.errBirthFuture');
      else if (d.getFullYear() < 1940) e.birth = t('confirm.errBirthRange');
    }
    if (draft.graduation) {
      const y = Number(draft.graduation.slice(0, 4));
      if (y < 1950 || y > today.getFullYear() + 10) e.graduation = t('confirm.errGradRange');
    }
    if (draft.skills.length === 0) e.skills = t('confirm.errSkills');
    if (!consent) e.consent = t('confirm.errConsent');
    return e;
  }, [draft, consent, t]);

  const addSkill = () => {
    const name = newSkill.trim();
    if (!name) return;
    if (draft.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setNewSkill('');
      return;
    }
    setDraft((d) => ({ ...d, skills: [...d.skills, { id: `u${Date.now()}`, name, confidence: 1 }] }));
    setNewSkill('');
  };

  const submit = async () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    const profile = {
      fullName: draft.name.trim(),
      birthDate: draft.birth || null,
      graduationDate: draft.graduation || null,
      skills: draft.skills.map((s) => s.name),
      preferences,
      documentId: documents[0]?.id ?? null,
    };
    try {
      await api.confirmProfile(profile);
      completeProfile(profile);
      onDone();
      navigate('/dashboard', { replace: true });
    } catch {
      setBusy(false);
    }
  };

  const show = (k: string) => (touched ? errors[k] : undefined);

  /* ------------------------------------------------------------ render -- */
  return (
    <div className="ob">
      <SiteHeader step={2} />
      <main className="ob__main" id="main">
        <div className="stage enter" style={{ maxWidth: '44rem', marginInline: 'auto', width: '100%' }}>
          <div className="stage__content">
            {/* Nothing was read on the manual and failed paths, so the screen
                stops claiming it was and simply asks for the details. */}
            <div className="stack stack--sm">
              <h1 className="headline">
                {entry === 'manual' || failed ? t('confirm.titleManual') : t('confirm.title')}
              </h1>
              <p className="subhead">
                {entry === 'manual' || failed ? t('confirm.emptySub') : t('confirm.sub')}
              </p>
            </div>

            {/* The bar belongs HERE most of all.
                This is the screen the user lands on after answering everything,
                and the one that has to wait for Agent A. Without it they get a
                bare skeleton with no percentage, no stage and no reason — which
                is indistinguishable from a hung app. */}
            <PipelineProgress />

            {waiting ? (
              <Card><LoadingBlock rows={4} /></Card>
            ) : (
              <>
                {uncertain.length > 0 && (
                  <Callout>
                    <div className="stack stack--sm">
                      <strong>{t('confirm.partialTitle')}</strong>
                      <p>{t('confirm.partialSub')}</p>
                    </div>
                  </Callout>
                )}

                <Card>
                  <div className="stack stack--lg">
                    <FieldRow
                      label={t('confirm.name')}
                      provenance={result?.fullName}
                      value={draft.name}
                      onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                      placeholder={t('confirm.namePlaceholder')}
                      error={show('name')}
                      autoComplete="name"
                    />
                    <FieldRow
                      label={t('confirm.birth')}
                      provenance={result?.birthDate}
                      value={draft.birth}
                      onChange={(v) => setDraft((d) => ({ ...d, birth: v }))}
                      type="date"
                      max={iso(today)}
                      error={show('birth')}
                      // Always empty, and not an oversight: Agent A does not
                      // extract a birth date — it is not a field it reads — so
                      // saying so beats an unexplained blank box. Optional.
                      hint={t('confirm.birthNotRead')}
                    />
                    <FieldRow
                      label={t('confirm.graduation')}
                      provenance={result?.graduationDate}
                      value={draft.graduation}
                      onChange={(v) => setDraft((d) => ({ ...d, graduation: v }))}
                      type="month"
                      error={show('graduation')}
                      hint={gradYearOnly && !draft.graduation
                        ? t('confirm.gradYearOnly', { year: gradYearOnly })
                        : undefined}
                    />
                  </div>
                </Card>

                {/* Skills lead as capability: these are things the user HAS. */}
                <Card>
                  <div className="stack">
                    <div className="stack stack--sm">
                      <h2 className="section__title">{t('confirm.skills')}</h2>
                      <p className="text-sm muted">{t('confirm.skillsSub')}</p>
                    </div>

                    {draft.skills.length > 0 ? (
                      <ul className="row" style={{ gap: 'var(--space-2)' }}>
                        {draft.skills.map((s) => {
                          const sure = isStrong(s.confidence);
                          return (
                            <li key={s.id}>
                              <span
                                className={`chip chip--removable ${sure ? 'chip--capability' : 'chip--gap'}`}
                                title={s.fromCourse ? t('confirm.skillFrom', { course: s.fromCourse }) : undefined}
                              >
                                {sure
                                  ? <Check size={14} aria-hidden="true" />
                                  : <HelpCircle size={14} aria-hidden="true" />}
                                <bdi>{s.name}</bdi>
                                {!sure && <span className="sr-only">{t('confirm.lowConfidence')}</span>}
                                <button
                                  type="button"
                                  className="chip__x"
                                  aria-label={`${t('action.remove')}: ${s.name}`}
                                  onClick={() => setDraft((d) => ({ ...d, skills: d.skills.filter((x) => x.id !== s.id) }))}
                                >
                                  <X size={14} aria-hidden="true" />
                                </button>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm muted">{t('confirm.skillsEmpty')}</p>
                    )}

                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <input
                        className="input"
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                        placeholder={t('confirm.addSkillPlaceholder')}
                        aria-label={t('confirm.addSkill')}
                      />
                      <Button variant="secondary" onClick={addSkill} disabled={!newSkill.trim()}>
                        <Plus size={16} aria-hidden="true" />
                        {t('action.add')}
                      </Button>
                    </div>

                    {show('skills') && (
                      <p className="field__error">
                        <AlertCircle size={14} aria-hidden="true" />
                        {errors.skills}
                      </p>
                    )}
                  </div>
                </Card>

                {/* Consent sits in the open, after the user has seen the data. */}
                <Card className="card--sunken">
                  <div className="stack stack--sm">
                    {/* The whole label is the hit area, well over the 44px
                        floor; the box itself is sized to clear WCAG 2.5.8.
                        .consent rather than .row: the generic helper wraps,
                        which dropped this sentence below the box on a phone. */}
                    <label className="consent">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      <span>{t('confirm.consent')}</span>
                    </label>
                    {show('consent') && (
                      <p className="field__error">
                        <AlertCircle size={14} aria-hidden="true" />
                        {errors.consent}
                      </p>
                    )}
                  </div>
                </Card>

                <div className="row">
                  <Button variant="secondary" onClick={() => navigate(-1)}>
                    {t('action.back')}
                  </Button>
                  <Button onClick={submit} loading={busy}>{t('confirm.cta')}</Button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * One confirmable field. The provenance line is the point: the user is told
 * where a value came from and how sure the reader was, so correcting it feels
 * like collaboration rather than cleaning up after a machine.
 */
function FieldRow({
  label, provenance, value, onChange, error, hint, ...rest
}: {
  label: string;
  provenance?: { confidence: number; evidence?: string } | null;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  /** Said about the field itself — why it is empty, or what is still needed. */
  hint?: string | null;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const { t } = useI18n();
  const sure = provenance ? isStrong(provenance.confidence) : null;

  return (
    <div className="field">
      <div className="row" style={{ gap: 'var(--space-3)' }}>
        <label className="field__label" htmlFor={`f-${label}`}>{label}</label>
        {provenance && (
          sure
            ? (
              <span className="source">
                <FileText size={13} aria-hidden="true" />
                {provenance.evidence ?? t('confirm.fromDoc')}
              </span>
            )
            : <span className="badge badge--suggested"><HelpCircle size={13} aria-hidden="true" />{t('confirm.lowConfidence')}</span>
        )}
      </div>
      <input
        id={`f-${label}`}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {hint && !error && <p className="field__hint">{hint}</p>}
      {!hint && sure === false && !error
        && <p className="field__hint">{t('confirm.lowConfidenceHelp')}</p>}
      {error && (
        <p className="field__error">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
