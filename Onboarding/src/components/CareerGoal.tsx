/**
 * The role the user is working towards, and the one control that changes it.
 *
 * WHY IT IS ITS OWN THING. The readiness score is a distance, and this is what
 * it is a distance TO. They used to be one paragraph — "Working towards Data
 * Analyst" set as a line of body copy under the heading — which made the target
 * read as a footnote on the score rather than as the other half of the
 * statement. The dashboard now puts where you ARE on one side and where you are
 * GOING on the other, and this owns the second side.
 *
 * THREE STATES, and the third is the one that matters most:
 *   named      — the user told us. Shown plainly, as their own words.
 *   suggested  — the agents inferred it. Shown, but labelled as a suggestion,
 *                because a guess that passes itself off as the user's own goal
 *                is the specific failure `suggestedRole` exists to prevent.
 *   neither    — "Finding your career goal". NOT an empty slot and not an error:
 *                a graduate who does not know what they want yet is the most
 *                common person this product serves, and the screen should say
 *                that is a normal place to be standing.
 *
 * Editing happens in place, like every other correction in this app (see the
 * section-by-section pattern on the profile screen). A menu that opened a modal
 * over a dashboard to change one string would be the heaviest interaction on
 * the page for the smallest change on it.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, MoreVertical, Target, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { useApi } from '../state/api';
import { emptyPreferences } from '../api';
import type { ConfirmedProfile, StoredProfile } from '../api';
import { Button, InputField } from './ui';
import { Menu, MenuItem } from './Menu';

export function CareerGoal({
  profile, onSaved,
}: {
  profile: StoredProfile | null;
  /** Refetch the dashboard: readiness and the journey are measured against this. */
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const api = useApi();

  const named = profile?.preferences?.preferredRole?.trim() ?? '';
  const suggested = profile?.suggestedRole?.title ?? '';
  const role = named || suggested;
  const isSuggested = !named && !!suggested;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const open = () => {
    // Seeds with the NAMED role only. Pre-filling the agents' suggestion would
    // turn "we think this might be you" into "you said this" the moment the
    // user pressed save without reading it.
    setDraft(named);
    setEditing(true);
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const next: ConfirmedProfile = {
      fullName: profile.fullName,
      birthDate: profile.birthDate,
      graduationDate: profile.graduationDate,
      phone: profile.phone ?? null,
      skills: profile.skills,
      preferences: {
        ...(profile.preferences ?? emptyPreferences()),
        preferredRole: draft.trim(),
      },
      documentId: profile.documentId,
    };
    try {
      // The same PUT the profile screen uses. A second write path for one
      // string is how two copies of a preference start disagreeing.
      await api.updateProfile(next);
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="goal goal--editing">
        <InputField
          label={t('q.preferredRole.label')}
          hint={t('dash.goalBlankHint')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('q.preferredRole.placeholder')}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void save(); }
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <div className="row row--tight">
          <Button onClick={save} loading={saving}>
            <Check size={16} aria-hidden="true" />
            {t('profile.save')}
          </Button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            <X size={16} aria-hidden="true" />
            {t('action.cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="goal">
      <div className="goal__text">
        <span className="eyebrow">{t('dash.targetLabel')}</span>
        {role ? (
          <>
            <p className="goal__role">
              <Target size={17} aria-hidden="true" />
              <strong><bdi>{role}</bdi></strong>
            </p>
            {/* Never dropped. The label is the whole difference between the
                product's inference and the user's own decision. */}
            {isSuggested && <p className="goal__hint">{t('dash.targetSuggested')}</p>}
          </>
        ) : (
          <>
            {/* A state, not a blank. `goal__role--finding` drops the gold and
                the weight: this is not a verdict, it is an open question. */}
            <p className="goal__role goal__role--finding">
              <Target size={17} aria-hidden="true" />
              <span>{t('dash.goalFinding')}</span>
            </p>
            {/* The one place on this page that points at Hud, and it earns it:
                he is where a role actually gets found, and this is the only
                state in which the user has nothing else to act on. */}
            <Link className="goal__hint goal__hint--link" to="/chat">
              {t('dash.goalFindingHelp')}
            </Link>
          </>
        )}
      </div>

      {/* Down and end-aligned: this sits at the top-end corner of the first
          card on the page, so the sidebar menu's default (upward, start
          aligned) would open it off the top of the card and out through its
          inline edge. */}
      <Menu
        label={t('dash.goalOptions')}
        trigger={<MoreVertical size={18} aria-hidden="true" />}
        drop="down"
        align="end"
      >
        {(close) => (
          <MenuItem onSelect={() => { close(); open(); }}>
            {t('dash.goalChange')}
          </MenuItem>
        )}
      </Menu>
    </div>
  );
}
