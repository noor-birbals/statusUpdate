import { PALETTE } from '@/lib/constants';
import type { AssigneeStoryPoints } from '@/lib/story-points';
import { formatStoryPoints } from '@/lib/story-points';
import { avatarBg, initials } from '@/lib/stats';

interface Props {
  rows: AssigneeStoryPoints[];
  totalPoints: number;
  boardLabel: string;
  selectedAssignee: string;
  onSelectAssignee: (name: string) => void;
}

export default function StoryPointsBar({
  rows,
  totalPoints,
  boardLabel,
  selectedAssignee,
  onSelectAssignee,
}: Props) {
  if (rows.length === 0) return null;

  function handleCardClick(name: string) {
    onSelectAssignee(selectedAssignee === name ? '' : name);
  }

  return (
    <div className="story-points-bar">
      <div className="story-points-header">
        <span className="story-points-title">Story points planned — {boardLabel}</span>
        <span className="story-points-total">{formatStoryPoints(totalPoints)} SP total</span>
      </div>
      <div className="story-points-scroll">
        <div className="story-points-grid">
          {rows.map((row) => {
            const selected = selectedAssignee === row.assignee;
            return (
              <button
                key={row.assignee}
                type="button"
                className={`story-points-card${selected ? ' selected' : ''}`}
                onClick={() => handleCardClick(row.assignee)}
                aria-pressed={selected}
                title={selected ? `Clear filter for ${row.assignee}` : `Filter by ${row.assignee}`}
              >
                <div className="story-points-card-top">
                  <span className="avatar" style={{ background: avatarBg(row.assignee, PALETTE) }}>
                    {initials(row.assignee)}
                  </span>
                  <span className="story-points-name">{row.assignee}</span>
                </div>
                <div className="story-points-value">{formatStoryPoints(row.points)} SP</div>
                <div className="story-points-sub">{row.issues} issues</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
