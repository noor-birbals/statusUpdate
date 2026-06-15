'use client';

import { useCallback, useEffect, useState } from 'react';
import { BOARDS, type BoardId } from '@/lib/constants';
import { fetchAllIssues, parseErrorHint } from '@/lib/jira-client';
import { aggregateIssues } from '@/lib/stats';
import type { BoardStats } from '@/lib/types';
import BoardContent from './BoardContent';
import CredentialsModal from './CredentialsModal';

const STORAGE_EMAIL = 'jira_email';
const STORAGE_TOKEN = 'jira_token';

interface BoardState {
  loading: boolean;
  error: string | null;
  stats: BoardStats | null;
}

const emptyBoard: BoardState = { loading: false, error: null, stats: null };

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<BoardId>('mic');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [showModal, setShowModal] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [headerSub, setHeaderSub] = useState('Connecting to Jira…');
  const [boards, setBoards] = useState<Record<BoardId, BoardState>>({
    mic: { ...emptyBoard },
    bib: { ...emptyBoard },
  });

  useEffect(() => {
    const savedEmail = localStorage.getItem(STORAGE_EMAIL) || '';
    const savedToken = localStorage.getItem(STORAGE_TOKEN) || '';
    if (savedEmail && savedToken) {
      setEmail(savedEmail);
      setToken(savedToken);
      setShowModal(false);
    }
  }, []);

  const loadBoard = useCallback(async (boardId: BoardId, creds: { email: string; token: string }) => {
    setBoards((prev) => ({
      ...prev,
      [boardId]: { ...prev[boardId], loading: true, error: null },
    }));

    try {
      const issues = await fetchAllIssues(BOARDS[boardId].host, creds.email, creds.token);
      const stats = aggregateIssues(issues);
      setBoards((prev) => ({
        ...prev,
        [boardId]: { loading: false, error: null, stats },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      const hint = parseErrorHint(msg);
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

  const loadAll = useCallback(async (creds: { email: string; token: string }) => {
    setRefreshing(true);
    await Promise.all([loadBoard('mic', creds), loadBoard('bib', creds)]);
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
    if (email && token && !showModal) {
      loadAll({ email, token });
    }
  }, [email, token, showModal, loadAll]);

  function handleSave(newEmail: string, newToken: string) {
    localStorage.setItem(STORAGE_EMAIL, newEmail);
    localStorage.setItem(STORAGE_TOKEN, newToken);
    setEmail(newEmail);
    setToken(newToken);
    setShowModal(false);
  }

  function openSettings() {
    setShowModal(true);
  }

  return (
    <>
      <CredentialsModal
        open={showModal}
        email={email}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />

      <div className="header">
        <div className="header-left">
          <h1>Sprint Command Centre</h1>
          <p>{headerSub}</p>
        </div>
        <div className="header-right">
          {lastUpdated && <span className="last-updated">{lastUpdated}</span>}
          <button
            className="hbtn"
            disabled={refreshing || showModal}
            onClick={() => loadAll({ email, token })}
          >
            {refreshing ? '↻ Loading…' : '↻ Refresh'}
          </button>
          <button className="hbtn" onClick={openSettings}>
            Settings
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
          <div key={id} className={`board${activeTab === id ? ' active' : ''}`} id={`board-${id}`}>
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
