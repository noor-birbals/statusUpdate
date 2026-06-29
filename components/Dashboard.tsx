'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BOARDS, type BoardId } from '@/lib/constants';
import { EMPTY_FILTERS, filterIssues, getAssignees, getIssueTypes, getStatuses, type DashboardFilters } from '@/lib/filters';
import { fetchAllIssues, fetchAuthUser, fetchSprints, logout, parseErrorHint } from '@/lib/jira-client';
import { getStoryPointsByAssignee, getTotalStoryPoints } from '@/lib/story-points';
import { aggregateIssues } from '@/lib/stats';
import type { JiraIssue, SprintInfo } from '@/lib/types';
import BoardContent from './BoardContent';
import FilterBar from './FilterBar';
import LoginScreen from './LoginScreen';
import StoryPointsBar from './StoryPointsBar';
import WeeklyReport from './WeeklyReport';

interface BoardState {
  loading: boolean;
  error: string | null;
  issues: JiraIssue[];
}

const emptyBoard: BoardState = { loading: false, error: null, issues: [] };

const AUTH_ERRORS: Record<string, string> = {
  oauth_not_configured: 'OAuth is not configured on the server. Set ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET.',
  access_denied: 'Sign-in was cancelled.',
  invalid_state: 'Sign-in failed (invalid state). Please try again.',
};

const defaultFilters = (): Record<BoardId, DashboardFilters> => ({
  mic: { ...EMPTY_FILTERS },
  bib: { ...EMPTY_FILTERS },
});

export default function Dashboard() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<BoardId>('mic');
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [headerSub, setHeaderSub] = useState('Sign in to load sprint data');
  const [showReport, setShowReport] = useState(false);
  const [filters, setFilters] = useState<Record<BoardId, DashboardFilters>>(defaultFilters);
  const [boards, setBoards] = useState<Record<BoardId, BoardState>>({
    mic: { ...emptyBoard },
    bib: { ...emptyBoard },
  });
  const [boardSprints, setBoardSprints] = useState<Record<BoardId, SprintInfo[]>>({ mic: [], bib: [] });
  const [selectedSprints, setSelectedSprints] = useState<Record<BoardId, SprintInfo | null>>({ mic: null, bib: null });
  const [sprintsLoading, setSprintsLoading] = useState<Record<BoardId, boolean>>({ mic: false, bib: false });

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setAuthError(AUTH_ERRORS[errorParam] || decodeURIComponent(errorParam));
    }
    if (searchParams.get('auth') === 'success') {
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams]);

  const checkAuth = useCallback(async () => {
    setAuthLoading(true);
    const user = await fetchAuthUser();
    if (user) {
      setAuthenticated(true);
      setUserName(user.userName || '');
      setUserEmail(user.userEmail || '');
      setAuthError(null);
    } else {
      setAuthenticated(false);
    }
    setAuthLoading(false);
    return !!user;
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const loadBoard = useCallback(async (boardId: BoardId, sprint?: SprintInfo | null) => {
    setBoards((prev) => ({
      ...prev,
      [boardId]: { ...prev[boardId], loading: true, error: null },
    }));

    try {
      const board = BOARDS[boardId];
      const jql = sprint
        ? `sprint = ${sprint.id} ORDER BY assignee ASC`
        : board.jql;
      const issues = await fetchAllIssues(board.host, jql, sprint ? undefined : board.fallbackJql);
      setBoards((prev) => ({
        ...prev,
        [boardId]: { loading: false, error: null, issues },
      }));

      // Fetch sprint list once after initial load
      if (!sprint) {
        const projectKey = issues[0]?.fields.project?.key;
        if (projectKey) {
          setSprintsLoading((prev) => ({ ...prev, [boardId]: true }));
          fetchSprints(board.host, projectKey)
            .then((sprints) => setBoardSprints((prev) => ({ ...prev, [boardId]: sprints })))
            .finally(() => setSprintsLoading((prev) => ({ ...prev, [boardId]: false })));
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      const hint = parseErrorHint(msg);
      if (msg.includes('401')) setAuthenticated(false);
      setBoards((prev) => ({
        ...prev,
        [boardId]: { loading: false, error: hint ? `${msg} — ${hint}` : msg, issues: [] },
      }));
    }
  }, []);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBoard('mic'), loadBoard('bib')]);
    const now = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    setLastUpdated(`Updated ${now}`);
    setHeaderSub('Micurato · Birbals — Live Sprint Data');
    setRefreshing(false);
  }, [loadBoard]);

  useEffect(() => {
    if (authenticated && !authLoading) {
      loadAll();
    }
  }, [authenticated, authLoading, loadAll]);

  async function handleLogout() {
    await logout();
    setAuthenticated(false);
    setUserName('');
    setUserEmail('');
    setHeaderSub('Sign in to load sprint data');
    setLastUpdated('');
    setFilters(defaultFilters());
    setBoards({ mic: { ...emptyBoard }, bib: { ...emptyBoard } });
    setBoardSprints({ mic: [], bib: [] });
    setSelectedSprints({ mic: null, bib: null });
  }

  function handleSprintChange(sprint: SprintInfo | null) {
    setSelectedSprints((prev) => ({ ...prev, [activeTab]: sprint }));
    setFilters((prev) => ({ ...prev, [activeTab]: { ...EMPTY_FILTERS } }));
    loadBoard(activeTab, sprint);
  }

  const activeBoard = boards[activeTab];
  const activeFilters = filters[activeTab];

  const filteredIssues = useMemo(
    () => filterIssues(activeBoard.issues, activeFilters),
    [activeBoard.issues, activeFilters],
  );

  const barFilters = useMemo(
    () => ({ ...activeFilters, assignee: '' }),
    [activeFilters],
  );

  const barIssues = useMemo(
    () => filterIssues(activeBoard.issues, barFilters),
    [activeBoard.issues, barFilters],
  );

  const assignees = useMemo(
    () => getAssignees(activeBoard.issues),
    [activeBoard.issues],
  );

  const issueTypes = useMemo(
    () => getIssueTypes(activeBoard.issues),
    [activeBoard.issues],
  );

  const statuses = useMemo(
    () => getStatuses(activeBoard.issues),
    [activeBoard.issues],
  );

  const storyPointRows = useMemo(
    () => getStoryPointsByAssignee(barIssues),
    [barIssues],
  );

  const totalStoryPoints = useMemo(
    () => getTotalStoryPoints(barIssues),
    [barIssues],
  );

  if (authLoading) {
    return (
      <div className="spinner-wrap" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <div className="spinner-label">Checking session…</div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen error={authError} />;
  }

  const displayName = userName || userEmail || 'Signed in';

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1>Sprint Command Centre</h1>
          <p>{headerSub}</p>
        </div>
        <div className="header-right">
          <span className="last-updated">{displayName}{lastUpdated ? ` · ${lastUpdated}` : ''}</span>
          <button className="hbtn" disabled={refreshing} onClick={loadAll}>
            {refreshing ? '↻ Loading…' : '↻ Refresh'}
          </button>
          <button
            className="hbtn hbtn-report"
            onClick={() => setShowReport(true)}
            disabled={!activeBoard.issues.length}
          >
            ⬇ Weekly Report
          </button>
          <button className="hbtn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>

      <div className="tabs">
        {(Object.keys(BOARDS) as BoardId[]).map((id) => (
          <button
            key={id}
            className={`tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {BOARDS[id].label}
          </button>
        ))}
      </div>

      {!activeBoard.loading && activeBoard.issues.length > 0 && (
        <StoryPointsBar
          rows={storyPointRows}
          totalPoints={totalStoryPoints}
          boardLabel={BOARDS[activeTab].label}
          selectedAssignee={activeFilters.assignee}
          onSelectAssignee={(name) =>
            setFilters((prev) => ({
              ...prev,
              [activeTab]: { ...prev[activeTab], assignee: name },
            }))
          }
        />
      )}

      {!activeBoard.loading && activeBoard.issues.length > 0 && (
        <FilterBar
          assignees={assignees}
          issueTypes={issueTypes}
          statuses={statuses}
          filters={activeFilters}
          totalCount={activeBoard.issues.length}
          filteredCount={filteredIssues.length}
          sprints={boardSprints[activeTab]}
          sprintsLoading={sprintsLoading[activeTab]}
          selectedSprint={selectedSprints[activeTab]}
          onSprintChange={handleSprintChange}
          onApply={(next) => setFilters((prev) => ({ ...prev, [activeTab]: next }))}
          onClear={() => {
            setFilters((prev) => ({ ...prev, [activeTab]: { ...EMPTY_FILTERS } }));
            if (selectedSprints[activeTab]) handleSprintChange(null);
          }}
        />
      )}

      {(Object.keys(BOARDS) as BoardId[]).map((id) => {
        const board = boards[id];
        const boardFilters = filters[id];
        const issues = filterIssues(board.issues, boardFilters);
        const stats = board.issues.length ? aggregateIssues(issues) : null;

        const sprintInfo = board.issues.find((i) => i.fields.sprint)?.fields.sprint ?? null;

        return (
          <div key={id} className={`board${activeTab === id ? ' active' : ''}`}>
            {board.error && (
              <div className="error-banner">
                <h4>Could not load {BOARDS[id].label} data</h4>
                <p>{board.error}</p>
              </div>
            )}
            {board.loading && (
              <div className="spinner-wrap">
                <div className="spinner" />
                <div className="spinner-label">Loading {BOARDS[id].label} sprint…</div>
              </div>
            )}
            {!board.loading && stats && issues.length > 0 && activeTab === id && (
              <BoardContent
                boardId={id}
                host={BOARDS[id].host}
                label={BOARDS[id].label}
                stats={stats}
                issues={issues}
                showProjects={id === 'bib'}
                sprintInfo={sprintInfo}
              />
            )}
          </div>
        );
      })}

      {!activeBoard.loading && activeBoard.issues.length > 0 && filteredIssues.length === 0 && (
        <div className="board active">
          <div className="empty-state" style={{ padding: 48 }}>
            No issues match the current filters. Try adjusting team member, issue type, status, or date range.
          </div>
        </div>
      )}

      {showReport && (
        <WeeklyReport
          issues={activeBoard.issues}
          boardLabel={BOARDS[activeTab].label}
          host={BOARDS[activeTab].host}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}
