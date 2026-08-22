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
import { AlertCircle, Check, FileText, HelpCircle, Plus, RotateCcw, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { useOnboarding } from '../state/onboarding';
import { useApi } from '../state/api';
import { useAuth } from '../state/auth';
import { isStrong } from '../api';
import type { Skill } from '../api';
import { Button, Callout, Card, LoadingBlock } from '../components/ui';
import {
  MIN_AGE, birthDateProblem, earliestBirthDate, isoDate, latestBirthDate,
} from '../lib/age';
import { SiteHeader } from '../components/SiteHeader';

interface Draft {
  name: string;
  birth: string;
  graduation: string;
  skills: Skill[];
}

const today = new Date();
/** Both bounds and the rule itself live in lib/age.ts; the profile screen
 *  collects the same field and has to enforce the same thing. */
const latestBirth = latestBirthDate(today);
const earliestBirth = earliestBirthDate(today);

export function Confirm() {
  const { t, formatNumber } = useI18n();
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
    /**
     * Still OPTIONAL — Agent A does not read a birth date and nothing in the
     * pipeline needs one, so an empty field is not an error and blocking on it
     * would invent a requirement. But a date that IS given has to be possible,
     * and has to clear the minimum age; under 17 blocks the submit, because
     * `errors` being non-empty is what stops it.
     */
    const birthProblem = birthDateProblem(draft.birth, today);
    if (birthProblem) {
      e.birth = t(birthProblem, { min: formatNumber(MIN_AGE) });
    }
    if (draft.graduation) {
      const y = Number(draft.graduation.slice(0, 4));
      if (y < 1950 || y > today.getFullYear() + 10) e.graduation = t('confirm.errGradRange');
    }
    if (draft.skills.length === 0) e.skills = t('confirm.errSkills');
    if (!consent) e.consent = t('confirm.errConsent');
    return e;
    // `formatNumber` joins `t` here: the age message interpolates the limit, so
    // a locale change has to re-run this or the numeral stays in the old script.
  }, [draft, consent, t, formatNumber]);

  /**
   * The two groups, partitioned once rather than branched per chip.
   *
   * `isStrong` is the same threshold every other confidence in this product is
   * judged against, so "found" here means exactly what "strong match" means on
   * a job card. Order within each group is the pipeline's, which is roughly
   * descending confidence; resorting would hide that.
   */
  const sureSkills = useMemo(
    () => draft.skills.filter((s) => isStrong(s.confidence)), [draft.skills]);
  const unsureSkills = useMemo(
    () => draft.skills.filter((s) => !isStrong(s.confidence)), [draft.skills]);

  /**
   * Removal is undoable, because it is the one destructive act on this screen
   * and the list it acts on was written by a machine. A user clearing a row
   * they misread has no other way back — the skill came from their document,
   * not from anything they could retype from memory.
   *
   * The removed row is held with its ORIGINAL INDEX so undo puts it back where
   * it was, rather than appending it to the end and quietly reordering the
   * evidence.
   */
  const [undo, setUndo] = useState<{ skill: Skill; at: number } | null>(null);

  const removeSkill = (id: string) => {
    setDraft((d) => {
      const at = d.skills.findIndex((x) => x.id === id);
      if (at === -1) return d;
      setUndo({ skill: d.skills[at], at });
      return { ...d, skills: d.skills.filter((x) => x.id !== id) };
    });
  };

  const undoRemove = () => {
    if (!undo) return;
    setDraft((d) => {
      const next = [...d.skills];
      next.splice(Math.min(undo.at, next.length), 0, undo.skill);
      return { ...d, skills: next };
    });
    setUndo(null);
  };

  /**
   * How many uncertain rows are shown before the rest are folded away.
   *
   * Deliberately HIGH. These are work the user has to do, so hiding them by
   * default would let someone confirm without seeing what they confirmed — the
   * opposite of what this screen is for. The fold exists only for the
   * pathological case a bad scan produces, where a dozen rows bury the consent
   * control below them.
   */
  const UNSURE_SHOWN = 6;
  const [showAllUnsure, setShowAllUnsure] = useState(false);

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
      // Never asked for here. Nothing in the pipeline reads a phone number, so
      // onboarding does not stop to collect one; it is offered later on the
      // profile screen for anyone who wants their own record complete.
      phone: null,
      skills: draft.skills.map((s) => s.name),
      preferences,
      documentId: documents[0]?.id ?? null,
    };
    try {
      await api.confirmProfile(profile);
      completeProfile(profile);
      onDone();
      /**
       * A first run lands in CHAT, not on the dashboard, and this is the only
       * place that distinction can be made: here we know the pipeline has just
       * been handed its answers, which is exactly the moment the dashboard has
       * nothing to show yet. Hud does, and he can say what is happening.
       *
       * Everyone else keeps arriving at the dashboard, through the catch-all
       * route in App.tsx. Someone returning is coming back to results, not to a
       * conversation.
       */
      /**
       * `findRole` carries the one thing chat cannot work out for itself: this
       * user stopped during onboarding to say they do not know what job they
       * want, so the conversation should open ON that rather than on a generic
       * "how can I help". Read from the stored preference rather than from a
       * navigation flag, so it stays true if this call ever moves.
       */
      navigate('/chat', {
        replace: true,
        state: { findRole: preferences.knowsRole === 'no' },
      });
    } catch {
      setBusy(false);
    }
  };

  const show = (k: string) => (touched ? errors[k] : undefined);

  /* ------------------------------------------------------------ render -- */
  return (
    <div className="ob">
      <SiteHeader step={2} />
      <main className="ob__main" id="main" tabIndex={-1}>
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

            {waiting ? (
              <Card><LoadingBlock rows={4} /></Card>
            ) : (
              <>
                {/* What could not be read, ABOVE the form and before anything
                    else. A transcript that failed to extract is the case this
                    exists for: the run finishes on the CV, which is right, and
                    used to finish silently — leaving the person to conclude
                    their transcript simply did not matter. */}
                {(result?.notices ?? []).length > 0 && (
                  <Callout tone="danger">
                    <div className="stack stack--sm">
                      {(result?.notices ?? []).map((id) => (
                        <p key={id}>{t(`notice.${id}`)}</p>
                      ))}
                    </div>
                  </Callout>
                )}

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
                      // Was `max={iso(today)}`, which allowed a newborn and
                      // opened the picker on this year. Both bounds now come
                      // from today's date, so nothing here needs maintaining
                      // when the year turns over.
                      min={isoDate(earliestBirth)}
                      max={isoDate(latestBirth)}
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

                {/* TWO GROUPS, NOT TWO CHIP COLOURS.
                    These used to be one flat list in which the only difference
                    between "confident" and "guessing" was a tick versus a
                    question mark and a slightly different tint. That is not a
                    distinction anyone reads at a glance, on the one screen whose
                    entire purpose is deciding what to trust.

                    They are now different SHAPES in different regions. Confident
                    skills stay compact chips; uncertain ones become rows in
                    their own well, each carrying the course it came from. The
                    second group also answers the two questions the flat list
                    left open: WHY a skill is in it, and that being unsure is not
                    an accusation. Both are said in words, because a dashed
                    border cannot say either. */}
                <Card>
                  <div className="stack">
                    <div className="stack stack--sm">
                      <h2 className="section__title">{t('confirm.skillsFound')}</h2>
                      <p className="text-sm muted">{t('confirm.skillsFoundSub')}</p>
                    </div>

                    {sureSkills.length > 0 ? (
                      <ul className="row" style={{ gap: 'var(--space-2)' }}>
                        {sureSkills.map((s) => (
                          <li key={s.id}>
                            <span
                              className="chip chip--removable chip--capability"
                              title={s.fromCourse ? t('confirm.skillFrom', { course: s.fromCourse }) : undefined}
                            >
                              <Check size={14} aria-hidden="true" />
                              <bdi>{s.name}</bdi>
                              <button
                                type="button"
                                className="chip__x"
                                aria-label={`${t('action.remove')}: ${s.name}`}
                                onClick={() => removeSkill(s.id)}
                              >
                                <X size={14} aria-hidden="true" />
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm muted">{t('confirm.skillsEmpty')}</p>
                    )}

                    {/* Rendered only when there IS one. A permanent empty panel
                        headed "skills to check" is a worry about nothing. */}
                    {unsureSkills.length > 0 && (
                      <div className="unsure">
                        <div className="stack stack--sm">
                          <h3 className="unsure__title">
                            <HelpCircle size={16} aria-hidden="true" />
                            {t('confirm.skillsUnsure')}
                          </h3>
                          <p className="text-sm">{t('confirm.skillsUnsureSub')}</p>
                        </div>

                        <ul className="unsure__list">
                          {(showAllUnsure ? unsureSkills : unsureSkills.slice(0, UNSURE_SHOWN)).map((s) => (
                            <li key={s.id} className="unsure__row">
                              <span className="unsure__name"><bdi>{s.name}</bdi></span>
                              {/* Provenance in the LAYOUT, not in a title
                                  attribute. As a tooltip it did not exist on a
                                  phone and did not exist for a keyboard, which
                                  between them are most of the people being asked
                                  to make this judgement.
                                  The NUMBER sits beside it because this is the
                                  one place the product was asking someone to
                                  judge a confidence it would not show them —
                                  every other confidence surface here states
                                  one, and "not sure" without a figure is the
                                  vaguest possible version of the truth. */}
                              <span className="unsure__from">
                                {s.fromCourse
                                  ? t('confirm.skillFrom', { course: s.fromCourse })
                                  : t('confirm.skillFromUnknown')}
                                <span className="unsure__pct num">
                                  {t('confirm.skillConfidence', {
                                    n: formatNumber(Math.round(s.confidence * 100)),
                                  })}
                                </span>
                              </span>
                              <button
                                type="button"
                                className="unsure__x"
                                aria-label={`${t('action.remove')}: ${s.name}`}
                                onClick={() => removeSkill(s.id)}
                              >
                                <X size={15} aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>

                        {unsureSkills.length > UNSURE_SHOWN && (
                          <button
                            type="button"
                            className="btn btn--ghost btn--block"
                            onClick={() => setShowAllUnsure((v) => !v)}
                            aria-expanded={showAllUnsure}
                          >
                            {showAllUnsure
                              ? t('confirm.skillsFewer')
                              : t('confirm.skillsMoreToCheck', {
                                n: formatNumber(unsureSkills.length - UNSURE_SHOWN),
                              })}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Undo for the one destructive act on this screen. Polite
                        live region, so it is announced without pulling focus
                        off whatever the user is reading next. */}
                    {undo && (
                      <p className="undo" role="status" aria-live="polite">
                        <span>{t('confirm.skillRemoved', { name: undo.skill.name })}</span>
                        <button type="button" className="undo__btn" onClick={undoRemove}>
                          <RotateCcw size={14} aria-hidden="true" />
                          {t('confirm.skillUndo')}
                        </button>
                      </p>
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
