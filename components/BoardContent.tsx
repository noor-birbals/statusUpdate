import type { BoardStats, JiraIssue, SprintInfo } from '@/lib/types';
import AllIssuesTable from './AllIssuesTable';
import BoardCharts from './BoardCharts';
import BlockersTable from './BlockersTable';

interface Props {
  boardId: string;
  host: string;
  label: string;
  stats: BoardStats;
  issues: JiraIssue[];
  showProjects?: boolean;
  sprintInfo?: SprintInfo | null;
}

export default function BoardContent({ boardId, host, stats, issues, showProjects, sprintInfo }: Props) {
  return (
    <>
      {sprintInfo && (
        <div className="sprint-badge">
          <span className="sprint-badge-label">Sprint</span>
          <span className="sprint-badge-name">{sprintInfo.name}</span>
          {sprintInfo.endDate && (
            <span className="sprint-badge-end">
              ends {new Date(sprintInfo.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      )}
      <div className="kpi-strip">
        <div className="kpi-card blue">
          <div className="kpi-value">{stats.total}</div>
          <div className="kpi-label">Total Issues</div>
          <div className="kpi-sub">Active sprint</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-value">{stats.done}</div>
          <div className="kpi-label">Done</div>
          <div className="kpi-sub">{stats.pct}% complete</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-value">{stats.inprog}</div>
          <div className="kpi-label">In Progress</div>
          <div className="kpi-sub">{stats.review} in review/QA</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-value">{stats.todo}</div>
          <div className="kpi-label">To Do</div>
          <div className="kpi-sub">Not started</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-value">{stats.blocked}</div>
          <div className="kpi-label">Blocked</div>
          <div className="kpi-sub">{stats.cancelled} cancelled</div>
        </div>
      </div>

      <div className="progress-card">
        <div className="progress-row">
          <span className="progress-title">Sprint Completion</span>
          <span className="progress-pct">{stats.pct}%</span>
        </div>
        <div className="pbar-wrap">
          <div className="pbar-fill" style={{ width: `${stats.pct}%` }} />
        </div>
        <div className="progress-legend">
          <span><span className="legend-dot" style={{ background: '#00875A' }} />Done: {stats.done}</span>
          <span><span className="legend-dot" style={{ background: '#0052CC' }} />In Progress: {stats.inprog}</span>
          <span><span className="legend-dot" style={{ background: '#FF8B00' }} />Review/QA: {stats.review}</span>
          <span><span className="legend-dot" style={{ background: '#97A0AF' }} />To Do: {stats.todo}</span>
          <span><span className="legend-dot" style={{ background: '#DE350B' }} />Blocked: {stats.blocked}</span>
        </div>
      </div>

      <BoardCharts boardId={boardId} stats={stats} showProjects={showProjects} />

      {stats.blocked > 0 && (
        <div className="table-card">
          <div className="chart-title">Blocked / On-Hold Issues</div>
          <BlockersTable host={host} stats={stats} />
        </div>
      )}

      <div className="table-card">
        <div className="chart-title">
          All Sprint Issues
          <span className="chart-sub">{issues.length} tickets</span>
        </div>
        <AllIssuesTable host={host} issues={issues} />
      </div>
    </>
  );
}
