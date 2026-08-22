/**
 * A course on the career map.
 *
 * FIVE STATES, and the reason each looks the way it does:
 *
 *   completed   filled, checked, and dimmed. Kept on the map rather than
 *               removed, because seeing what you have finished IS the progress
 *               signal. Dimming is the reward, not deletion.
 *   current     the strongest thing on the canvas. Raised surface, accent ring,
 *               and the only node carrying a primary action.
 *   recommended available AND the one Itqan would pick next. Marked, but not
 *               louder than current — two things competing for "do this" is
 *               how a map stops being navigable.
 *   available   plain surface, actionable, quiet.
 *   locked      visible and legible, with the reason stated. NOT hidden: the
 *               brief is explicit that the user should be able to see where the
 *               path goes, and a map that hides its own destination is a list.
 *
 * "Locked" here is a UI state, never a product one. Nothing in this app stops a
 * person opening a course they want; a locked node means the skills it builds
 * on are not evidenced yet, which is information, not a gate.
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Check, Lock, Sparkles, ExternalLink, Clock } from 'lucide-react';

export type CourseState =
  | 'completed'
  | 'current'
  | 'recommended'
  | 'available'
  | 'locked';

export interface CourseNodeData extends Record<string, unknown> {
  title: string;
  provider: string;
  /** Pre-formatted by the caller: money and durations are locale-sensitive. */
  price: string;
  duration: string | null;
  /** Skills this course unlocks. Two at most on the node; the rest is detail. */
  unlocks: string[];
  state: CourseState;
  url: string;
  /** Localised strings, passed in so the node stays free of i18n plumbing. */
  labels: {
    open: string;
    done: string;
    completed: string;
    recommended: string;
    locked: string;
    current: string;
    available: string;
  };
  onDone?: () => void;
  incoming: Position;
  outgoing: Position;
}

const BADGE: Partial<Record<CourseState, { icon: typeof Check; key: keyof CourseNodeData['labels'] }>> = {
  completed: { icon: Check, key: 'completed' },
  current: { icon: Sparkles, key: 'current' },
  recommended: { icon: Sparkles, key: 'recommended' },
  locked: { icon: Lock, key: 'locked' },
};

function CourseNodeBase({ data }: NodeProps) {
  const d = data as CourseNodeData;
  const badge = BADGE[d.state];
  const Icon = badge?.icon;

  return (
    <div className="mapnode mapnode--course" data-state={d.state}>
      <Handle type="target" position={d.incoming} isConnectable={false} />
      <Handle type="source" position={d.outgoing} isConnectable={false} />

      {badge && Icon && (
        <span className="mapnode__badge">
          <Icon size={12} aria-hidden="true" />
          {d.labels[badge.key]}
        </span>
      )}

      <span className="mapnode__provider">{d.provider}</span>
      <span className="mapnode__title">{d.title}</span>

      <span className="mapnode__meta">
        <span className="mapnode__price">{d.price}</span>
        {d.duration && (
          <span className="mapnode__hours">
            <Clock size={12} aria-hidden="true" />
            {d.duration}
          </span>
        )}
      </span>

      {d.unlocks.length > 0 && (
        <span className="mapnode__unlocks">
          {d.unlocks.slice(0, 2).map((u) => (
            <span className="mapnode__skill" key={u}>{u}</span>
          ))}
        </span>
      )}

      {/* Actions only where acting makes sense. A completed node keeps its link
          so the user can go back to what they finished, but loses the Done
          button; a locked node has neither. */}
      {d.state !== 'locked' && (
        <span className="mapnode__actions">
          {/* `stopPropagation` on both controls: the whole card is a click
              target now (React Flow's `onNodeClick`), so without it opening the
              provider's site would ALSO open the detail sheet behind it. */}
          <a
            className="mapnode__open"
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            {d.labels.open}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
          {d.state !== 'completed' && d.onDone && (
            <button
              className="mapnode__done"
              type="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); d.onDone?.(); }}
            >
              {d.labels.done}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

export const CourseNode = memo(CourseNodeBase);
