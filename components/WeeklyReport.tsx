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

type IssueCategory = 'Task' | 'Sub-task' | 'Bug' | 'Story' | 'Other';

interface AssigneeReport {
  name: string;
  tasks: JiraIssue[];
  subtasks: JiraIssue[];
  bugs: JiraIssue[];
  others: JiraIssue[];
}

function categorise(issue: JiraIssue): IssueCategory {
  const t = (issue.fields.issuetype?.name || '').toLowerCase();
  if (t.includes('bug')) return 'Bug';
  if (t.includes('sub-task') || t.includes('subtask')) return 'Sub-task';
  if (t.includes('story') || t.includes('task')) return 'Task';
  return 'Other';
}

function statusLabel(issue: JiraIssue): string {
  const name = issue.fields.status?.name || '';
  const cat = classify(name);
  if (cat === 'done') return 'Done';
  if (cat === 'inprogress' || cat === 'codereview') return 'In Progress';
  if (cat === 'review' || cat === 'qa') return 'In Review';
  if (cat === 'blocked') return 'Blocked';
  if (cat === 'cancelled') return 'Cancelled';
  return name;
}

function statusColor(issue: JiraIssue): string {
  const cat = classify(issue.fields.status?.name || '');
  if (cat === 'done') return '#00875A';
  if (cat === 'inprogress' || cat === 'codereview') return '#0052CC';
  if (cat === 'review' || cat === 'qa') return '#6554C0';
  if (cat === 'blocked') return '#DE350B';
  if (cat === 'cancelled') return '#97A0AF';
  return '#97A0AF';
}

function issueUrl(host: string, key: string) {
  return `https://${host}/browse/${key}`;
}

function buildReports(issues: JiraIssue[]): AssigneeReport[] {
  const map = new Map<string, AssigneeReport>();

  for (const issue of issues) {
    const name = issue.fields.assignee?.displayName || 'Unassigned';
    if (!map.has(name)) {
      map.set(name, { name, tasks: [], subtasks: [], bugs: [], others: [] });
    }
    const r = map.get(name)!;
    const cat = categorise(issue);
    if (cat === 'Bug') r.bugs.push(issue);
    else if (cat === 'Sub-task') r.subtasks.push(issue);
    else if (cat === 'Task' || cat === 'Story') r.tasks.push(issue);
    else r.others.push(issue);
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function sprintName(issues: JiraIssue[]): string {
  return issues.find((i) => i.fields.sprint)?.fields.sprint?.name ?? 'Current Sprint';
}

interface IssueRowProps {
  issue: JiraIssue;
  host: string;
}

function IssueRow({ issue, host }: IssueRowProps) {
  return (
    <tr className="report-row">
      <td className="report-key">
        <a href={issueUrl(host, issue.key)} target="_blank" rel="noreferrer">
          {issue.key}
        </a>
      </td>
      <td className="report-summary">{issue.fields.summary}</td>
      <td className="report-status">
        <span className="report-status-chip" style={{ background: statusColor(issue) }}>
          {statusLabel(issue)}
        </span>
      </td>
      <td className="report-points">{issue.fields.storyPoints ?? '—'}</td>
    </tr>
  );
}

interface SectionProps {
  title: string;
  issues: JiraIssue[];
  host: string;
  color: string;
}

function Section({ title, issues, host, color }: SectionProps) {
  if (!issues.length) return null;
  const done = issues.filter((i) => classify(i.fields.status?.name || '') === 'done').length;
  return (
    <div className="report-section">
      <div className="report-section-header" style={{ borderLeftColor: color }}>
        <span className="report-section-title">{title}</span>
        <span className="report-section-count">{issues.length} issues · {done} done</span>
      </div>
      <table className="report-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Summary</th>
            <th>Status</th>
            <th>SP</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => <IssueRow key={i.key} issue={i} host={host} />)}
        </tbody>
      </table>
    </div>
  );
}

export default function WeeklyReport({ issues, boardLabel, host, onClose }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const reports = useMemo(() => buildReports(issues), [issues]);
  const sprint = useMemo(() => sprintName(issues), [issues]);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  function handlePrint() {
    window.print();
  }

  return (
    <div className="report-overlay">
      <div className="report-modal">
        <div className="report-toolbar no-print">
          <div>
            <strong>Weekly Sprint Report</strong>
            <span style={{ marginLeft: 12, color: '#6B778C', fontSize: 13 }}>{boardLabel} · {sprint}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="hbtn hbtn-report" onClick={handlePrint}>⬇ Save as PDF</button>
            <button className="hbtn" onClick={onClose}>✕ Close</button>
          </div>
        </div>

        <div className="report-body" ref={reportRef}>
          <div className="report-cover">
            <div className="report-cover-title">Weekly Sprint Report</div>
            <div className="report-cover-sub">{boardLabel} · {sprint}</div>
            <div className="report-cover-date">Generated {today}</div>
          </div>

          <div className="report-summary-strip">
            <div className="report-summary-card">
              <div className="report-summary-value">{issues.length}</div>
              <div className="report-summary-label">Total Issues</div>
            </div>
            <div className="report-summary-card">
              <div className="report-summary-value" style={{ color: '#00875A' }}>
                {issues.filter((i) => classify(i.fields.status?.name || '') === 'done').length}
              </div>
              <div className="report-summary-label">Completed</div>
            </div>
            <div className="report-summary-card">
              <div className="report-summary-value" style={{ color: '#DE350B' }}>
                {issues.filter((i) => classify(i.fields.status?.name || '') === 'blocked').length}
              </div>
              <div className="report-summary-label">Blocked</div>
            </div>
            <div className="report-summary-card">
              <div className="report-summary-value">{reports.length}</div>
              <div className="report-summary-label">Contributors</div>
            </div>
          </div>

          {reports.map((r) => {
            const totalDone = [...r.tasks, ...r.subtasks, ...r.bugs, ...r.others]
              .filter((i) => classify(i.fields.status?.name || '') === 'done').length;
            const totalIssues = r.tasks.length + r.subtasks.length + r.bugs.length + r.others.length;

            return (
              <div key={r.name} className="report-person">
                <div className="report-person-header">
                  <div className="report-person-avatar">
                    {r.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="report-person-name">{r.name}</div>
                    <div className="report-person-meta">
                      {totalIssues} issues · {totalDone} completed
                      {r.tasks.length > 0 && ` · ${r.tasks.length} task${r.tasks.length !== 1 ? 's' : ''}`}
                      {r.subtasks.length > 0 && ` · ${r.subtasks.length} sub-task${r.subtasks.length !== 1 ? 's' : ''}`}
                      {r.bugs.length > 0 && ` · ${r.bugs.length} bug${r.bugs.length !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>

                <Section title="Tasks & Stories" issues={r.tasks} host={host} color="#0052CC" />
                <Section title="Sub-tasks" issues={r.subtasks} host={host} color="#6554C0" />
                <Section title="Bugs" issues={r.bugs} host={host} color="#DE350B" />
                {r.others.length > 0 && (
                  <Section title="Other" issues={r.others} host={host} color="#97A0AF" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
