import { PALETTE } from '@/lib/constants';
import type { AssigneeStoryPoints } from '@/lib/story-points';
import { formatStoryPoints } from '@/lib/story-points';
import { avatarBg, initials } from '@/lib/stats';

interface Props {
  rows: AssigneeStoryPoints[];
  totalPoints: number;
  boardLabel: string;
}

export default function StoryPointsBar({ rows, totalPoints, boardLabel }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="story-points-bar">
      <div className="story-points-header">
        <span className="story-points-title">Story points planned — {boardLabel}</span>
        <span className="story-points-total">{formatStoryPoints(totalPoints)} SP total</span>
      </div>
      <div className="story-points-scroll">
        <div className="story-points-grid">
          {rows.map((row) => (
            <div key={row.assignee} className="story-points-card">
              <div className="story-points-card-top">
                <span className="avatar" style={{ background: avatarBg(row.assignee, PALETTE) }}>
                  {initials(row.assignee)}
                </span>
                <span className="story-points-name" title={row.assignee}>{row.assignee}</span>
              </div>
              <div className="story-points-value">{formatStoryPoints(row.points)} SP</div>
              <div className="story-points-sub">{row.issues} issues</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
