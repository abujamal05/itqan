/**
 * The record section: a titled card that flips between reading and editing.
 *
 * EXTRACTED, NOT INVENTED. This is the Profile screen's own section, lifted out
 * unchanged when Settings split off it. Both screens are the same kind of thing
 * — a record of you that you read and correct — so they have to look like one
 * screen seen twice rather than two screens that resemble each other. Two
 * copies of this would have drifted the first time either was touched.
 *
 * The heading, the edit control, the save/cancel row and the anchor id all live
 * here so no section re-implements them.
 */
import type { ReactNode } from 'react';
import { Check, Pencil, User as UserIcon, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { Button, Card } from './ui';

export function Section({
  id, title, icon: Icon, editing, onEdit, onCancel, onSave, saving, children,
}: {
  /** Anchors the section, so the missing-information box can send you to it —
   *  from the other screen now, which is why the id has to be stable. */
  id: string;
  title: string;
  icon: typeof UserIcon;
  editing: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  saving?: boolean;
  children: ReactNode;
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

/** One read only row. Missing values say so rather than rendering blank. */
export function Row({ label, value }: { label: string; value: string | null | undefined }) {
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
