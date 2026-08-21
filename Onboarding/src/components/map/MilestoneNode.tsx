/**
 * A dashboard milestone on the career map.
 *
 * Four of these carry the whole journey: documents read, role chosen, skills
 * built, jobs applied to.
 *
 * A MILESTONE IS A PIN, A COURSE IS A CARD. A milestone is a place you arrive
 * at and a course is a thing you do, so they must not look like the same
 * object. The pin is a marker with its name under it and no surface of its own,
 * which is also what keeps all four legible at full zoom in a dashboard strip.
 *
 * The detail line is carried by the CURRENT pin only. On every other pin it was
 * repeating what the state already said, and four stacked captions turned a
 * route into a paragraph laid out sideways.
 *
 * State is never colour alone. Done carries a check, current carries a filled
 * ring and the only halo on the canvas, upcoming is an open outline. The hidden
 * list in MapCanvas states each one in words as well.
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface MilestoneData extends Record<string, unknown> {
  label: string;
  detail?: string;
  state: 'done' | 'current' | 'upcoming';
  /** Set only where a stage has a page worth being the destination of. */
  to?: string;
  /** Which side the edges attach to. Flipped for RTL by the caller. */
  incoming: Position;
  outgoing: Position;
}

function MilestoneNodeBase({ data }: NodeProps) {
  const d = data as MilestoneData;

  return (
    <div className="mapnode mapnode--milestone" data-state={d.state}>
      {/* Handles are the attachment points React Flow routes edges between.
          Hidden, because this is a map and nothing here is connectable. */}
      <Handle type="target" position={d.incoming} isConnectable={false} />
      <Handle type="source" position={d.outgoing} isConnectable={false} />

      <span className="mapnode__marker">
        {d.state === 'done'
          ? <Check size={16} aria-hidden="true" />
          : <span className="mapnode__dot" />}
      </span>

      {/* Where a milestone has a page, the NAME is the way there. A separate
          arrow button floating off the corner of a pin was a control looking
          for a card to live on. */}
      {d.to ? (
        <Link className="mapnode__label mapnode__label--go" to={d.to} tabIndex={-1}>
          {d.label}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      ) : (
        <span className="mapnode__label">{d.label}</span>
      )}

      {d.detail && d.state === 'current' && (
        <span className="mapnode__detail">{d.detail}</span>
      )}
    </div>
  );
}

export const MilestoneNode = memo(MilestoneNodeBase);
