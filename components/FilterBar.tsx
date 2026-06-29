'use client';

import { useEffect, useRef, useState } from 'react';
import type { DashboardFilters } from '@/lib/filters';
import { hasActiveFilters } from '@/lib/filters';
import type { SprintInfo } from '@/lib/types';

interface Props {
  assignees: string[];
  issueTypes: string[];
  statuses: string[];
  filters: DashboardFilters;
  totalCount: number;
  filteredCount: number;
  sprints?: SprintInfo[];
  sprintsLoading?: boolean;
  selectedSprint?: SprintInfo | null;
  onSprintChange?: (sprint: SprintInfo | null) => void;
  onApply: (filters: DashboardFilters) => void;
  onClear: () => void;
}

export default function FilterBar({
  assignees,
  issueTypes,
  statuses,
  filters,
  totalCount,
  filteredCount,
  sprints = [],
  sprintsLoading = false,
  selectedSprint = null,
  onSprintChange,
  onApply,
  onClear,
}: Props) {
  const [userQuery, setUserQuery] = useState('');
  const [userOpen, setUserOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [sprintOpen, setSprintOpen] = useState(false);
  const [draftDateFrom, setDraftDateFrom] = useState(filters.dateFrom);
  const [draftDateTo, setDraftDateTo] = useState(filters.dateTo);
  const userBoxRef = useRef<HTMLDivElement>(null);
  const statusBoxRef = useRef<HTMLDivElement>(null);
  const sprintBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftDateFrom(filters.dateFrom);
    setDraftDateTo(filters.dateTo);
  }, [filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    if (!filters.assignee) setUserQuery('');
    else if (!userOpen) setUserQuery(filters.assignee);
  }, [filters.assignee, userOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (userBoxRef.current && !userBoxRef.current.contains(target)) {
        setUserOpen(false);
      }
      if (statusBoxRef.current && !statusBoxRef.current.contains(target)) {
        setStatusOpen(false);
      }
      if (sprintBoxRef.current && !sprintBoxRef.current.contains(target)) {
        setSprintOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredAssignees = assignees.filter((name) =>
    name.toLowerCase().includes(userQuery.toLowerCase()),
  );

  const datesDirty =
    draftDateFrom !== filters.dateFrom || draftDateTo !== filters.dateTo;
  const hasDraftDates = Boolean(draftDateFrom || draftDateTo);

  function selectUser(name: string) {
    onApply({ ...filters, assignee: name });
    setUserQuery(name);
    setUserOpen(false);
  }

  function clearUser() {
    onApply({ ...filters, assignee: '' });
    setUserQuery('');
    setUserOpen(false);
  }

  function submitDates() {
    onApply({ ...filters, dateFrom: draftDateFrom, dateTo: draftDateTo });
  }

  function handleClear() {
    setDraftDateFrom('');
    setDraftDateTo('');
    setUserQuery('');
    setUserOpen(false);
    setStatusOpen(false);
    setSprintOpen(false);
    onClear();
  }

  function toggleStatus(status: string) {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onApply({ ...filters, statuses: next });
  }

  function clearStatuses() {
    onApply({ ...filters, statuses: [] });
  }

  const statusLabel =
    filters.statuses.length === 0
      ? 'All statuses'
      : filters.statuses.length === 1
        ? filters.statuses[0]
        : `${filters.statuses.length} statuses selected`;

  const sprintLabel = selectedSprint ? selectedSprint.name : 'Current Sprint';
  const active = hasActiveFilters(filters) || Boolean(selectedSprint);

  return (
    <div className="filter-bar">
      {onSprintChange && (
        <div className="filter-group filter-group-sprint" ref={sprintBoxRef}>
          <label>Sprint</label>
          <div className="sprint-select-wrap">
            <button
              type="button"
              className={`sprint-select-trigger${selectedSprint ? ' has-selection' : ''}`}
              onClick={() => setSprintOpen((o) => !o)}
            >
              <span className="sprint-select-label">{sprintLabel}</span>
              <span className="sprint-select-chevron" aria-hidden>▾</span>
            </button>
            {selectedSprint && (
              <button
                type="button"
                className="sprint-select-clear"
                onClick={() => { onSprintChange(null); setSprintOpen(false); }}
                title="Back to current sprint"
              >×</button>
            )}
            {sprintOpen && (
              <ul className="sprint-select-dropdown">
                <li>
                  <button
                    type="button"
                    className={!selectedSprint ? 'active' : ''}
                    onClick={() => { onSprintChange(null); setSprintOpen(false); }}
                  >
                    Current Sprint
                  </button>
                </li>
                {sprintsLoading && (
                  <li style={{ padding: '8px 14px', fontSize: 12, color: '#97A0AF' }}>Loading sprints…</li>
                )}
                {sprints.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={selectedSprint?.id === s.id ? 'active' : ''}
                      onClick={() => { onSprintChange(s); setSprintOpen(false); }}
                    >
                      <span className="sprint-option-name">{s.name}</span>
                      {s.endDate && (
                        <span className="sprint-option-date">
                          {s.state === 'active' ? 'Active' : new Date(s.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="filter-group filter-group-user" ref={userBoxRef}>
        <label htmlFor="filter-assignee">Team member</label>
        <div className="user-search-wrap">
          <input
            id="filter-assignee"
            type="text"
            className="user-search-input"
            placeholder="Search team members…"
            value={userQuery}
            onChange={(e) => {
              setUserQuery(e.target.value);
              setUserOpen(true);
              if (filters.assignee && e.target.value !== filters.assignee) {
                onApply({ ...filters, assignee: '' });
              }
            }}
            onFocus={() => setUserOpen(true)}
          />
          {filters.assignee && (
            <button type="button" className="user-search-clear" onClick={clearUser} title="Clear user">
              ×
            </button>
          )}
          {userOpen && (
            <ul className="user-search-dropdown">
              <li>
                <button type="button" className={!filters.assignee ? 'active' : ''} onClick={clearUser}>
                  All team members
                </button>
              </li>
              {filteredAssignees.length === 0 ? (
                <li className="user-search-empty">No matches</li>
              ) : (
                filteredAssignees.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className={filters.assignee === name ? 'active' : ''}
                      onClick={() => selectUser(name)}
                    >
                      {name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-issue-type">Issue type</label>
        <select
          id="filter-issue-type"
          value={filters.issueType}
          onChange={(e) => onApply({ ...filters, issueType: e.target.value })}
        >
          <option value="">All issue types</option>
          {issueTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group filter-group-status" ref={statusBoxRef}>
        <label htmlFor="filter-status">Status</label>
        <div className="status-multi-wrap">
          <button
            id="filter-status"
            type="button"
            className={`status-multi-trigger${filters.statuses.length > 0 ? ' has-selection' : ''}`}
            onClick={() => setStatusOpen((open) => !open)}
            aria-expanded={statusOpen}
            aria-haspopup="listbox"
          >
            <span className="status-multi-label">{statusLabel}</span>
            {filters.statuses.length === 0 && (
              <span className="status-multi-chevron" aria-hidden>
                ▾
              </span>
            )}
          </button>
          {filters.statuses.length > 0 && (
            <button
              type="button"
              className="status-multi-clear"
              onClick={clearStatuses}
              title="Clear status filter"
            >
              ×
            </button>
          )}
          {statusOpen && (
            <ul className="status-multi-dropdown" role="listbox" aria-multiselectable>
              {statuses.length === 0 ? (
                <li className="status-multi-empty">No statuses</li>
              ) : (
                statuses.map((status) => {
                  const checked = filters.statuses.includes(status);
                  return (
                    <li key={status}>
                      <label className={`status-multi-option${checked ? ' active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStatus(status)}
                        />
                        <span>{status}</span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-date-from">Updated from</label>
        <input
          id="filter-date-from"
          type="date"
          value={draftDateFrom}
          onChange={(e) => setDraftDateFrom(e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="filter-date-to">Updated to</label>
        <input
          id="filter-date-to"
          type="date"
          value={draftDateTo}
          min={draftDateFrom || undefined}
          onChange={(e) => setDraftDateTo(e.target.value)}
        />
      </div>

      <div className="filter-actions">
        {(hasDraftDates || datesDirty) && (
          <button
            type="button"
            className="filter-submit"
            onClick={submitDates}
            disabled={!draftDateFrom && !draftDateTo}
          >
            Submit
          </button>
        )}
        {(active || hasDraftDates || datesDirty) && (
          <button type="button" className="filter-clear" onClick={handleClear}>
            Clear
          </button>
        )}
      </div>

      {(active || hasDraftDates || datesDirty) && (
        <span className="filter-count">
          Showing {filteredCount} of {totalCount} issues
        </span>
      )}
    </div>
  );
}
