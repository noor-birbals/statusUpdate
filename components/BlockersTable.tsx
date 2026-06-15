import { PALETTE } from '@/lib/constants';
import { avatarBg, badgeClass, classify, initials } from '@/lib/stats';
import type { BoardStats } from '@/lib/types';

interface Props {
  host: string;
  stats: BoardStats;
}

export default function BlockersTable({ host, stats }: Props) {
  const base = `https://${host}`;

  if (stats.blockers.length === 0) {
    return <div className="empty-state">No blocked issues right now!</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Key</th>
          <th>Summary</th>
          <th>Assignee</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {stats.blockers.map((b) => (
          <tr key={b.key}>
            <td>
              <a className="issue-key" href={`${base}/browse/${b.key}`} target="_blank" rel="noopener noreferrer">
                {b.key}
              </a>
            </td>
            <td style={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {b.summary}
            </td>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span className="avatar" style={{ background: avatarBg(b.assignee, PALETTE) }}>
                  {initials(b.assignee)}
                </span>
                <span>{b.assignee}</span>
              </div>
            </td>
            <td>
              <span className={`badge ${badgeClass(classify(b.status))}`}>{b.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
