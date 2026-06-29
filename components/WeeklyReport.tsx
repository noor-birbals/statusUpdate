'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import type { JiraIssue, SprintInfo } from '@/lib/types';
import { classify } from '@/lib/stats';
import { fetchSprints, fetchIssuesForSprint } from '@/lib/jira-client';

interface Props {
  issues: JiraIssue[];
  boardLabel: string;
  host: string;
  onClose: () => void;
}

interface AssigneeSummary {
  name: string;
  initials: string;
  tasks: { done: number; total: number; issues: JiraIssue[] };
  subtasks: { done: number; total: number; issues: JiraIssue[] };
  bugs: { done: number; total: number; issues: JiraIssue[] };
  allIssues: JiraIssue[];
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

function roundSP(val: number): string {
  const r = Math.round(val * 10) / 10;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
}

function statusChipColor(issue: JiraIssue): string {
  const cat = classify(issue.fields.status?.name || '');
  if (cat === 'done') return '#00875A';
  if (cat === 'inprogress' || cat === 'codereview') return '#0052CC';
  if (cat === 'review' || cat === 'qa') return '#FF8B00';
  if (cat === 'blocked') return '#DE350B';
  return '#97A0AF';
}

function buildSummaries(issues: JiraIssue[]): AssigneeSummary[] {
  const map = new Map<string, AssigneeSummary>();

  for (const issue of issues) {
    const name = issue.fields.assignee?.displayName || 'Unassigned';
    if (!map.has(name)) {
      map.set(name, {
        name,
        initials: getInitials(name),
        tasks: { done: 0, total: 0, issues: [] },
        subtasks: { done: 0, total: 0, issues: [] },
        bugs: { done: 0, total: 0, issues: [] },
        allIssues: [],
        storyPoints: 0,
        blocked: 0,
      });
    }
    const s = map.get(name)!;
    const typeName = (issue.fields.issuetype?.name || '').toLowerCase();
    const done = isDone(issue);
    const blocked = isBlocked(issue);
    const sp = issue.fields.storyPoints ?? 0;

    s.allIssues.push(issue);
    if (blocked) s.blocked++;
    if (done && sp > 0) s.storyPoints = Math.round((s.storyPoints + sp) * 10) / 10;

    if (typeName.includes('bug')) {
      s.bugs.total++;
      s.bugs.issues.push(issue);
      if (done) s.bugs.done++;
    } else if (typeName.includes('sub-task') || typeName.includes('subtask')) {
      s.subtasks.total++;
      s.subtasks.issues.push(issue);
      if (done) s.subtasks.done++;
    } else {
      s.tasks.total++;
      s.tasks.issues.push(issue);
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
  const spRaw = issues.filter(isDone).reduce((sum, i) => sum + (i.fields.storyPoints ?? 0), 0);
  const sp = Math.round(spRaw * 10) / 10;
  const bugs = issues.filter((i) => (i.fields.issuetype?.name || '').toLowerCase().includes('bug'));
  const bugsFixed = bugs.filter(isDone).length;
  const contributors = new Set(issues.map((i) => i.fields.assignee?.displayName || 'Unassigned')).size;
  return { done, blocked, total, pct, sp, bugsFixed, contributors };
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
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

interface TicketFooterProps { issues: JiraIssue[]; host: string; label: string; color: string; }
function TicketFooter({ issues, host, label, color }: TicketFooterProps) {
  if (!issues.length) return null;
  return (
    <div className="report-ticket-footer">
      <div className="report-ticket-footer-label" style={{ color }}>{label}</div>
      <div className="report-ticket-list">
        {issues.map((issue) => (
          <a
            key={issue.key}
            href={`https://${host}/browse/${issue.key}`}
            target="_blank"
            rel="noreferrer"
            className="report-ticket-chip"
            title={issue.fields.summary || ''}
            style={{ borderColor: statusChipColor(issue), color: statusChipColor(issue) }}
          >
            {issue.key}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function WeeklyReport({ issues: initialIssues, boardLabel, host, onClose }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sprintDropdownRef = useRef<HTMLDivElement>(null);

  // Sprint selection state
  const [sprints, setSprints] = useState<SprintInfo[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<SprintInfo | null>(null);
  const [sprintDropdownOpen, setSprintDropdownOpen] = useState(false);
  const [reportIssues, setReportIssues] = useState<JiraIssue[]>(initialIssues);
  const [loadingIssues, setLoadingIssues] = useState(false);

  // Person filter state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const sprint = useMemo(() => sprintName(reportIssues), [reportIssues]);

  // Fetch available sprints on mount
  useEffect(() => {
    const projectKey = initialIssues[0]?.fields.project?.key;
    if (!projectKey) return;
    fetchSprints(host, projectKey).then(setSprints);
  }, [host, initialIssues]);

  // Fetch issues when sprint changes
  useEffect(() => {
    if (!selectedSprint) {
      setReportIssues(initialIssues);
      return;
    }
    setLoadingIssues(true);
    fetchIssuesForSprint(host, selectedSprint.id, 'assignee is not EMPTY AND statusCategory != Done ORDER BY updated DESC')
      .then((fetched) => { setReportIssues(fetched); setLoadingIssues(false); })
      .catch(() => setLoadingIssues(false));
  }, [selectedSprint, host, initialIssues]);

  const allSummaries = useMemo(() => buildSummaries(reportIssues), [reportIssues]);

  const assigneeNames = useMemo(
    () => allSummaries.map((s) => s.name).sort((a, b) => a.localeCompare(b)),
    [allSummaries],
  );

  // Close both dropdowns when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (sprintDropdownRef.current && !sprintDropdownRef.current.contains(e.target as Node)) {
        setSprintDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggleName(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => prev.size === assigneeNames.length ? new Set() : new Set(assigneeNames));
  }

  const isAll = selected.size === 0;
  const summaries = useMemo(
    () => isAll ? allSummaries : allSummaries.filter((s) => selected.has(s.name)),
    [allSummaries, selected, isAll],
  );

  const filteredIssues = useMemo(
    () => isAll ? reportIssues : reportIssues.filter((i) => selected.has(i.fields.assignee?.displayName || 'Unassigned')),
    [reportIssues, selected, isAll],
  );

  const overall = useMemo(() => overallStats(filteredIssues), [filteredIssues]);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const dropdownLabel = isAll
    ? 'All Team Members'
    : selected.size === 1
      ? [...selected][0]
      : `${selected.size} members selected`;

  const reportTitle = isAll
    ? 'Weekly Sprint Report'
    : selected.size === 1
      ? `${[...selected][0]} — Sprint Report`
      : 'Weekly Sprint Report';

  return (
    <div className="report-overlay">
      <div className="report-modal">
        <div className="report-toolbar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <strong>Weekly Sprint Report</strong>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              {boardLabel} · {sprint}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

            {/* Sprint dropdown */}
            {sprints.length > 0 && (
              <div className="report-multiselect" ref={sprintDropdownRef}>
                <button
                  className="report-multiselect-trigger"
                  onClick={() => setSprintDropdownOpen((o) => !o)}
                  style={{ minWidth: 180 }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedSprint ? selectedSprint.name : 'Current Sprint'}
                  </span>
                  <svg width="10" height="6" viewBox="0 0 10 6" style={{ flexShrink: 0, transform: sprintDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M0 0l5 6 5-6z" fill="rgba(255,255,255,0.7)" />
                  </svg>
                </button>
                {sprintDropdownOpen && (
                  <div className="report-multiselect-menu">
                    <button
                      className="report-sprint-item report-sprint-item-current"
                      onClick={() => { setSelectedSprint(null); setSprintDropdownOpen(false); }}
                    >
                      Current Sprint
                      {!selectedSprint && <span className="report-sprint-active-dot" />}
                    </button>
                    <div className="report-multiselect-divider" />
                    {sprints.map((s) => (
                      <button
                        key={s.id}
                        className="report-sprint-item"
                        onClick={() => { setSelectedSprint(s); setSprintDropdownOpen(false); }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                          {s.endDate && (
                            <div style={{ fontSize: 11, color: '#97A0AF', marginTop: 1 }}>
                              {s.state === 'active' ? 'Active · ends ' : 'Ended '}
                              {new Date(s.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                        {selectedSprint?.id === s.id && <span className="report-sprint-active-dot" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Multi-select dropdown */}
            <div className="report-multiselect" ref={dropdownRef}>
              <button
                className="report-multiselect-trigger"
                onClick={() => setDropdownOpen((o) => !o)}
              >
                <span>{dropdownLabel}</span>
                <svg width="10" height="6" viewBox="0 0 10 6" style={{ flexShrink: 0, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  <path d="M0 0l5 6 5-6z" fill="rgba(255,255,255,0.7)" />
                </svg>
              </button>
              {dropdownOpen && (
                <div className="report-multiselect-menu">
                  <label className="report-multiselect-item report-multiselect-all">
                    <input
                      type="checkbox"
                      checked={selected.size === assigneeNames.length}
                      ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < assigneeNames.length; }}
                      onChange={toggleAll}
                    />
                    <span>All Team Members</span>
                  </label>
                  <div className="report-multiselect-divider" />
                  {assigneeNames.map((name) => (
                    <label key={name} className="report-multiselect-item">
                      <input
                        type="checkbox"
                        checked={selected.has(name)}
                        onChange={() => toggleName(name)}
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button className="hbtn hbtn-report" onClick={() => window.print()}>⬇ Save as PDF</button>
            <button className="hbtn" onClick={onClose}>✕ Close</button>
          </div>
        </div>

        {loadingIssues && (
          <div className="report-loading-overlay">
            <div className="spinner" />
            <div className="spinner-label">Loading sprint data…</div>
          </div>
        )}

        <div className="report-body" ref={reportRef} style={{ opacity: loadingIssues ? 0.4 : 1, pointerEvents: loadingIssues ? 'none' : 'auto' }}>
          {/* Cover */}
          <div className="report-cover">
            <div className="report-cover-eyebrow">{boardLabel}</div>
            <div className="report-cover-title">{reportTitle}</div>
            <div className="report-cover-sub">{selectedSprint ? selectedSprint.name : sprint}</div>
            <div className="report-cover-date">{today}</div>
          </div>

          {/* Sprint health */}
          <div className="report-section-heading">Sprint Health</div>
          <div className="report-health-grid">
            <div className="report-health-card">
              <div className="report-health-value" style={{ color: '#00875A' }}>{overall.pct}%</div>
              <div className="report-health-label">Completion</div>
              <div className="report-health-sub">{overall.done} of {overall.total} issues done</div>
            </div>
            <div className="report-health-card">
              <div className="report-health-value">{overall.sp > 0 ? roundSP(overall.sp) : '—'}</div>
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
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#0052CC', marginRight: 5 }} />In Progress: {filteredIssues.filter((i) => classify(i.fields.status?.name || '') === 'inprogress').length}</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#FF8B00', marginRight: 5 }} />Review/QA: {filteredIssues.filter((i) => ['review','codereview','qa'].includes(classify(i.fields.status?.name || ''))).length}</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#DE350B', marginRight: 5 }} />Blocked: {overall.blocked}</span>
            </div>
          </div>

          {/* Per-person */}
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
                        {s.storyPoints > 0 && ` · ${roundSP(s.storyPoints)} SP`}
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

                  {/* Jira links footer — all tickets */}
                  <div className="report-tickets-section">
                    <TicketFooter issues={s.allIssues} host={host} label="All Tickets" color="#42526E" />
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
