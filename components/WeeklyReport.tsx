'use client';

import { useMemo, useRef } from 'react';
import type { JiraIssue } from '@/lib/types';
import { classify } from '@/lib/stats';

interface Props {
  issues: JiraIssue[];
  boardLabel: string;
  host: string;
  onClose: () => void;
}

interface AssigneeSummary {
  name: string;
  initials: string;
  tasks: { done: number; total: number };
  subtasks: { done: number; total: number };
  bugs: { done: number; total: number };
  storyPoints: number;
  blocked: number;
}

function isDone(issue: JiraIssue) {
  return classify(issue.fields.status?.name || '') === 'done';
}

function isBlocked(issue: JiraIssue) {
  return classify(issue.fields.status?.name || '') === 'blocked';
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
}

function buildSummaries(issues: JiraIssue[]): AssigneeSummary[] {
  const map = new Map<string, AssigneeSummary>();

  for (const issue of issues) {
    const name = issue.fields.assignee?.displayName || 'Unassigned';
    if (!map.has(name)) {
      map.set(name, {
        name,
        initials: getInitials(name),
        tasks: { done: 0, total: 0 },
        subtasks: { done: 0, total: 0 },
        bugs: { done: 0, total: 0 },
        storyPoints: 0,
        blocked: 0,
      });
    }
    const s = map.get(name)!;
    const typeName = (issue.fields.issuetype?.name || '').toLowerCase();
    const done = isDone(issue);
    const blocked = isBlocked(issue);
    const sp = issue.fields.storyPoints ?? 0;

    if (blocked) s.blocked++;
    if (done && sp > 0) s.storyPoints += sp;

    if (typeName.includes('bug')) {
      s.bugs.total++;
      if (done) s.bugs.done++;
    } else if (typeName.includes('sub-task') || typeName.includes('subtask')) {
      s.subtasks.total++;
      if (done) s.subtasks.done++;
    } else {
      s.tasks.total++;
      if (done) s.tasks.done++;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aScore = a.tasks.done + a.subtasks.done + a.bugs.done;
    const bScore = b.tasks.done + b.subtasks.done + b.bugs.done;
    return bScore - aScore;
  });
}

function sprintName(issues: JiraIssue[]): string {
  return issues.find((i) => i.fields.sprint)?.fields.sprint?.name ?? 'Current Sprint';
}

function overallStats(issues: JiraIssue[]) {
  const done = issues.filter(isDone).length;
  const blocked = issues.filter(isBlocked).length;
  const total = issues.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const sp = issues.filter(isDone).reduce((sum, i) => sum + (i.fields.storyPoints ?? 0), 0);
  const bugs = issues.filter((i) => (i.fields.issuetype?.name || '').toLowerCase().includes('bug'));
  const bugsFixed = bugs.filter(isDone).length;
  return { done, blocked, total, pct, sp, bugsFixed, contributors: new Set(issues.map((i) => i.fields.assignee?.displayName || 'Unassigned')).size };
}

interface MiniBarProps { value: number; total: number; color: string; }
function MiniBar({ value, total, color }: MiniBarProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B778C', marginBottom: 3 }}>
        <span>{value}/{total} done</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 6, background: '#F0F2F5', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

export default function WeeklyReport({ issues, boardLabel, onClose }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const summaries = useMemo(() => buildSummaries(issues), [issues]);
  const sprint = useMemo(() => sprintName(issues), [issues]);
  const overall = useMemo(() => overallStats(issues), [issues]);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="report-overlay">
      <div className="report-modal">
        <div className="report-toolbar no-print">
          <div>
            <strong>Weekly Sprint Report</strong>
            <span style={{ marginLeft: 12, color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              {boardLabel} · {sprint}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="hbtn hbtn-report" onClick={() => window.print()}>⬇ Save as PDF</button>
            <button className="hbtn" onClick={onClose}>✕ Close</button>
          </div>
        </div>

        <div className="report-body" ref={reportRef}>
          {/* Cover */}
          <div className="report-cover">
            <div className="report-cover-eyebrow">{boardLabel}</div>
            <div className="report-cover-title">Weekly Sprint Report</div>
            <div className="report-cover-sub">{sprint}</div>
            <div className="report-cover-date">{today}</div>
          </div>

          {/* Sprint health overview */}
          <div className="report-section-heading">Sprint Health</div>
          <div className="report-health-grid">
            <div className="report-health-card">
              <div className="report-health-value" style={{ color: '#00875A' }}>{overall.pct}%</div>
              <div className="report-health-label">Completion</div>
              <div className="report-health-sub">{overall.done} of {overall.total} issues done</div>
            </div>
            <div className="report-health-card">
              <div className="report-health-value">{overall.sp > 0 ? overall.sp : '—'}</div>
              <div className="report-health-label">Story Points Delivered</div>
              <div className="report-health-sub">Across completed issues</div>
            </div>
            <div className="report-health-card">
              <div className="report-health-value" style={{ color: '#DE350B' }}>{overall.bugsFixed}</div>
              <div className="report-health-label">Bugs Resolved</div>
              <div className="report-health-sub">This sprint</div>
            </div>
            <div className="report-health-card">
              <div className="report-health-value" style={{ color: overall.blocked > 0 ? '#FF8B00' : '#6B778C' }}>
                {overall.blocked}
              </div>
              <div className="report-health-label">Blockers</div>
              <div className="report-health-sub">{overall.contributors} contributors</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="report-progress-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
              <span>Overall Sprint Progress</span>
              <span style={{ color: '#00875A' }}>{overall.pct}%</span>
            </div>
            <div style={{ height: 10, background: '#DFE1E6', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${overall.pct}%`, background: 'linear-gradient(90deg,#0052CC,#00875A)', borderRadius: 5 }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: '#6B778C', flexWrap: 'wrap' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#00875A', marginRight: 5 }} />Done: {overall.done}</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#0052CC', marginRight: 5 }} />In Progress: {issues.filter((i) => classify(i.fields.status?.name || '') === 'inprogress').length}</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#FF8B00', marginRight: 5 }} />Review/QA: {issues.filter((i) => ['review','codereview','qa'].includes(classify(i.fields.status?.name || ''))).length}</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#DE350B', marginRight: 5 }} />Blocked: {overall.blocked}</span>
            </div>
          </div>

          {/* Per-person summaries */}
          <div className="report-section-heading">Individual Contributions</div>
          <div className="report-people-grid">
            {summaries.map((s) => {
              const totalDone = s.tasks.done + s.subtasks.done + s.bugs.done;
              const totalAll = s.tasks.total + s.subtasks.total + s.bugs.total;
              const personPct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

              return (
                <div key={s.name} className="report-person-card">
                  <div className="report-person-card-header">
                    <div className="report-person-avatar">{s.initials}</div>
                    <div>
                      <div className="report-person-name">{s.name}</div>
                      <div className="report-person-meta">
                        {totalDone}/{totalAll} done · {personPct}%
                        {s.storyPoints > 0 && ` · ${s.storyPoints} SP delivered`}
                        {s.blocked > 0 && <span style={{ color: '#DE350B' }}> · {s.blocked} blocked</span>}
                      </div>
                    </div>
                  </div>

                  <div className="report-person-stats">
                    {s.tasks.total > 0 && (
                      <div className="report-stat-row">
                        <div className="report-stat-label">
                          <span className="report-type-dot" style={{ background: '#0052CC' }} />
                          Tasks &amp; Stories
                        </div>
                        <MiniBar value={s.tasks.done} total={s.tasks.total} color="#0052CC" />
                      </div>
                    )}
                    {s.subtasks.total > 0 && (
                      <div className="report-stat-row">
                        <div className="report-stat-label">
                          <span className="report-type-dot" style={{ background: '#6554C0' }} />
                          Sub-tasks
                        </div>
                        <MiniBar value={s.subtasks.done} total={s.subtasks.total} color="#6554C0" />
                      </div>
                    )}
                    {s.bugs.total > 0 && (
                      <div className="report-stat-row">
                        <div className="report-stat-label">
                          <span className="report-type-dot" style={{ background: '#DE350B' }} />
                          Bugs
                        </div>
                        <MiniBar value={s.bugs.done} total={s.bugs.total} color="#DE350B" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
