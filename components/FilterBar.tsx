'use client';

import { useEffect, useRef, useState } from 'react';
import type { DashboardFilters } from '@/lib/filters';
import { hasActiveFilters } from '@/lib/filters';

interface Props {
  assignees: string[];
  filters: DashboardFilters;
  totalCount: number;
  filteredCount: number;
  onApply: (filters: DashboardFilters) => void;
  onClear: () => void;
}

export default function FilterBar({
  assignees,
  filters,
  totalCount,
  filteredCount,
  onApply,
  onClear,
}: Props) {
  const [userQuery, setUserQuery] = useState('');
  const [userOpen, setUserOpen] = useState(false);
  const [draftDateFrom, setDraftDateFrom] = useState(filters.dateFrom);
  const [draftDateTo, setDraftDateTo] = useState(filters.dateTo);
  const userBoxRef = useRef<HTMLDivElement>(null);

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
      if (userBoxRef.current && !userBoxRef.current.contains(e.target as Node)) {
        setUserOpen(false);
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
  const active = hasActiveFilters(filters);

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
    onClear();
  }

  return (
    <div className="filter-bar">
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
