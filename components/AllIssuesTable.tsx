import { PALETTE } from '@/lib/constants';
import { avatarBg, badgeClass, classify, initials } from '@/lib/stats';
import { getStoryPoints } from '@/lib/story-points';
import type { JiraIssue } from '@/lib/types';

interface Props {
  host: string;
  issues: JiraIssue[];
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AllIssuesTable({ host, issues }: Props) {
  const base = `https://${host}`;

  if (issues.length === 0) {
    return <div className="empty-state">No issues in this sprint.</div>;
  }

  return (
    <div className="issues-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Summary</th>
            <th>Type</th>
            <th>Assignee</th>
            <th>Status</th>
            <th>SP</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => {
            const f = issue.fields || {};
            const status = f.status?.name || 'Unknown';
            const assignee = f.assignee?.displayName || 'Unassigned';
            const type = f.issuetype?.name || 'Other';
            const sp = getStoryPoints(issue);

            return (
              <tr key={issue.key}>
                <td>
                  <a
                    className="issue-key"
                    href={`${base}/browse/${issue.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {issue.key}
                  </a>
                </td>
                <td className="issue-summary">{f.summary || '—'}</td>
                <td>{type}</td>
                <td>
                  <div className="assignee-cell">
                    <span className="avatar" style={{ background: avatarBg(assignee, PALETTE) }}>
                      {initials(assignee)}
                    </span>
                    <span>{assignee}</span>
                  </div>
                </td>
                <td>
                  <span className={`badge ${badgeClass(classify(status))}`}>{status}</span>
                </td>
                <td className="issue-sp">{sp > 0 ? sp : '—'}</td>
                <td className="issue-date">{formatDate(f.updated)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
