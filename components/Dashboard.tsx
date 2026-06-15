'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BOARDS, type BoardId } from '@/lib/constants';
import { fetchAllIssues, fetchAuthUser, logout, parseErrorHint } from '@/lib/jira-client';
import { aggregateIssues } from '@/lib/stats';
import type { BoardStats } from '@/lib/types';
import BoardContent from './BoardContent';
import LoginScreen from './LoginScreen';

interface BoardState {
  loading: boolean;
  error: string | null;
  stats: BoardStats | null;
}

const emptyBoard: BoardState = { loading: false, error: null, stats: null };

const AUTH_ERRORS: Record<string, string> = {
  oauth_not_configured: 'OAuth is not configured on the server. Set ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET.',
  access_denied: 'Sign-in was cancelled.',
  invalid_state: 'Sign-in failed (invalid state). Please try again.',
};

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
  const [boards, setBoards] = useState<Record<BoardId, BoardState>>({
    mic: { ...emptyBoard },
    bib: { ...emptyBoard },
  });

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

  const loadBoard = useCallback(async (boardId: BoardId) => {
    setBoards((prev) => ({
      ...prev,
      [boardId]: { ...prev[boardId], loading: true, error: null },
    }));

    try {
      const issues = await fetchAllIssues(BOARDS[boardId].host);
      const stats = aggregateIssues(issues);
      setBoards((prev) => ({
        ...prev,
        [boardId]: { loading: false, error: null, stats },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      const hint = parseErrorHint(msg);
      if (msg.includes('401')) {
        setAuthenticated(false);
      }
      setBoards((prev) => ({
        ...prev,
        [boardId]: {
          loading: false,
          error: hint ? `${msg} — ${hint}` : msg,
          stats: null,
        },
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
    setBoards({ mic: { ...emptyBoard }, bib: { ...emptyBoard } });
  }

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

      {(Object.keys(BOARDS) as BoardId[]).map((id) => {
        const board = boards[id];
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
            {!board.loading && board.stats && (
              <BoardContent
                boardId={id}
                host={BOARDS[id].host}
                label={BOARDS[id].label}
                stats={board.stats}
                showProjects={id === 'bib'}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
