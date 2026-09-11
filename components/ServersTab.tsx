'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ServerEntry, ServerStatus } from '@/lib/types';

const COLUMNS: { status: ServerStatus; label: string; dot: string }[] = [
  { status: 'active', label: 'Active — not yet reviewed', dot: 'orange' },
  { status: 'flagged', label: 'Flagged — do not delete', dot: 'red' },
  { status: 'ready', label: 'Ready to delete', dot: 'blue' },
  { status: 'done', label: 'Decommissioned', dot: 'green' },
];

const STATUS_LABEL: Record<ServerStatus, string> = {
  active: 'Active',
  flagged: 'Flagged',
  ready: 'Ready to delete',
  done: 'Decommissioned',
};

const BADGE_CLASS: Record<ServerStatus, string> = {
  active: 'orange',
  flagged: 'red',
  ready: 'blue',
  done: 'green',
};

function siteHref(w: string): string | null {
  const domain = w.trim().split(/\s+/)[0];
  if (!domain) return null;
  if (/^https?:\/\//i.test(domain)) return domain;
  return `https://${domain}`;
}

function linesToList(v: string): string[] {
  return v.split('\n').map((s) => s.trim()).filter(Boolean);
}

interface FormState {
  name: string;
  ip: string;
  hostname: string;
  os: string;
  status: ServerStatus;
  plan: string;
  region: string;
  websites: string;
  databases: string;
  desc: string;
  backup: string;
}

const emptyForm: FormState = {
  name: '', ip: '', hostname: '', os: '', status: 'active',
  plan: '', region: '', websites: '', databases: '', desc: '', backup: '',
};

export default function ServersTab() {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<ServerEntry | null>(null);
  const [detailStatus, setDetailStatus] = useState<ServerStatus>('active');
  const [detailWebsites, setDetailWebsites] = useState('');
  const [detailDatabases, setDetailDatabases] = useState('');
  const [detailNotes, setDetailNotes] = useState('');
  const [detailSaving, setDetailSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/servers');
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setServers(data.servers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<ServerStatus, number> = { active: 0, flagged: 0, ready: 0, done: 0 };
    servers.forEach((s) => {
      c[s.status] = (c[s.status] || 0) + 1;
    });
    return c;
  }, [servers]);

  const backupsSecured = useMemo(
    () => servers.filter((s) => s.backup && !/no backup/i.test(s.backup)).length,
    [servers],
  );

  const sorted = useMemo(
    () => [...servers].sort((a, b) => a.name.localeCompare(b.name)),
    [servers],
  );

  function openDetail(s: ServerEntry) {
    setDetail(s);
    setDetailStatus(s.status);
    setDetailWebsites((s.websites || []).join('\n'));
    setDetailDatabases((s.databases || []).join('\n'));
    setDetailNotes(s.notes || '');
  }

  async function handleAdd() {
    if (!form.name.trim()) {
      showToast('Give it a name first');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          ip: form.ip.trim(),
          hostname: form.hostname.trim(),
          os: form.os.trim(),
          status: form.status,
          plan: form.plan.trim(),
          region: form.region.trim(),
          websites: linesToList(form.websites),
          databases: linesToList(form.databases),
          desc: form.desc.trim(),
          backup: form.backup.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setServers((prev) => [...prev, data.server]);
      setForm(emptyForm);
      setShowAdd(false);
      showToast('Server added');
    } catch {
      showToast('Could not add — try again');
    } finally {
      setSaving(false);
    }
  }

  async function handleDetailSave() {
    if (!detail) return;
    setDetailSaving(true);
    try {
      const res = await fetch(`/api/servers/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: detailStatus,
          websites: linesToList(detailWebsites),
          databases: linesToList(detailDatabases),
          notes: detailNotes,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setServers((prev) => prev.map((s) => (s.id === detail.id ? data.server : s)));
      setDetail(null);
      showToast('Saved');
    } catch {
      showToast('Could not save — try again');
    } finally {
      setDetailSaving(false);
    }
  }

  async function handleDetailDelete() {
    if (!detail) return;
    if (!window.confirm(`Remove "${detail.name}" from the board?`)) return;
    try {
      const res = await fetch(`/api/servers/${detail.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setServers((prev) => prev.filter((s) => s.id !== detail.id));
      setDetail(null);
      showToast('Removed');
    } catch {
      showToast('Could not delete — try again');
    }
  }

  if (loading) {
    return (
      <div className="spinner-wrap" style={{ minHeight: '40vh' }}>
        <div className="spinner" />
        <div className="spinner-label">Loading servers…</div>
      </div>
    );
  }

  return (
    <div className="board active">
      {error && (
        <div className="error-banner">
          <h4>Could not load servers</h4>
          <p>{error}</p>
        </div>
      )}

      <div className="srv-toolbar">
        <h2>Server inventory</h2>
        <button className="hbtn srv-add-btn" onClick={() => setShowAdd(true)}>
          + Add server
        </button>
      </div>

      <div className="kpi-strip srv-kpi-strip">
        <div className="kpi-card blue">
          <div className="kpi-value">{servers.length}</div>
          <div className="kpi-label">Servers tracked</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-value">{counts.active}</div>
          <div className="kpi-label">Active, unreviewed</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-value">{counts.flagged}</div>
          <div className="kpi-label">Flagged active</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-value">{counts.ready}</div>
          <div className="kpi-label">Ready to delete</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-value">{counts.done}</div>
          <div className="kpi-label">Decommissioned</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-value">{backupsSecured}</div>
          <div className="kpi-label">Backups secured</div>
        </div>
      </div>

      <div className="srv-board">
        {COLUMNS.map((col) => {
          const items = sorted.filter((s) => s.status === col.status);
          return (
            <div className="srv-col" key={col.status}>
              <div className="srv-col-head">
                <span className={`srv-col-dot ${col.dot}`} />
                <span className="srv-col-title">{col.label}</span>
                <span className="srv-col-count">{items.length}</span>
              </div>
              <div className="srv-col-cards">
                {items.length === 0 && <div className="srv-empty-col">Nothing here</div>}
                {items.map((s) => (
                  <div key={s.id} className={`srv-card st-${s.status}`} onClick={() => openDetail(s)}>
                    <div className="srv-card-top">
                      <div>
                        <div className="srv-card-name">{s.name || 'Unnamed'}</div>
                        {(s.linodeLabel || s.hostname) && (
                          <div className="srv-card-host">{s.linodeLabel || s.hostname}</div>
                        )}
                      </div>
                      <span className={`srv-badge ${BADGE_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                    </div>
                    <div className="srv-card-ip">{s.ip || '—'}</div>
                    {s.os && <div className="srv-card-sub">{s.os}</div>}
                    {s.region && <div className="srv-card-sub">{s.region}</div>}
                    {!!(s.websites && s.websites.length) && (
                      <div className="srv-chips">
                        {s.websites.map((w, i) => {
                          const href = siteHref(w);
                          return href ? (
                            <a
                              key={i}
                              className="srv-chip"
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {w}
                            </a>
                          ) : (
                            <span key={i} className="srv-chip">{w}</span>
                          );
                        })}
                      </div>
                    )}
                    {!!(s.databases && s.databases.length) && (
                      <div className="srv-chips">
                        {s.databases.map((d, i) => (
                          <span key={i} className="srv-chip db">🗄 {d}</span>
                        ))}
                      </div>
                    )}
                    {s.desc && <div className="srv-card-desc">{s.desc}</div>}
                    <div className="srv-card-meta">
                      {s.plan && (
                        <div className="srv-meta-item">Plan<b>{s.plan}</b></div>
                      )}
                      {s.disk && (
                        <div className="srv-meta-item">Disk<b>{s.disk}</b></div>
                      )}
                      {s.mem && (
                        <div className="srv-meta-item">Memory<b>{s.mem}</b></div>
                      )}
                      {s.lastBackup ? (
                        <div className="srv-meta-item">Last backup<b>{s.lastBackup}</b></div>
                      ) : s.backup ? (
                        <div className="srv-meta-item">Backup<b>{s.backup.split('\n')[0].slice(0, 22)}</b></div>
                      ) : null}
                    </div>
                    {s.status === 'flagged' && s.flagNote && (
                      <div className="srv-flag-note">⚠ {s.flagNote}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {toastMsg && <div className="toast show">{toastMsg}</div>}

      {showAdd && (
        <div
          className="modal-bg"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAdd(false);
          }}
        >
          <div className="modal srv-modal-wide">
            <h2>Add a server</h2>
            <p>Log a new machine into the server inventory.</p>
            <div className="srv-field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Analytics DB" />
            </div>
            <div className="srv-field-row">
              <div className="srv-field">
                <label>IP address</label>
                <input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="0.0.0.0" />
              </div>
              <div className="srv-field">
                <label>Hostname</label>
                <input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="optional" />
              </div>
            </div>
            <div className="srv-field-row">
              <div className="srv-field">
                <label>OS</label>
                <input value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} placeholder="e.g. Ubuntu 24.04" />
              </div>
              <div className="srv-field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ServerStatus })}>
                  <option value="active">Active — not yet reviewed</option>
                  <option value="flagged">Flagged — do not delete</option>
                  <option value="ready">Ready to delete</option>
                  <option value="done">Decommissioned</option>
                </select>
              </div>
            </div>
            <div className="srv-field-row">
              <div className="srv-field">
                <label>Linode plan</label>
                <input value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} placeholder="e.g. Dedicated 8 GB" />
              </div>
              <div className="srv-field">
                <label>Region</label>
                <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. US, Fremont, CA" />
              </div>
            </div>
            <div className="srv-field">
              <label>Websites hosted here</label>
              <textarea
                value={form.websites}
                onChange={(e) => setForm({ ...form, websites: e.target.value })}
                placeholder={'One per line, e.g.\ncopyworldinc.com'}
              />
            </div>
            <div className="srv-field">
              <label>Databases (SQL) on this server</label>
              <textarea
                value={form.databases}
                onChange={(e) => setForm({ ...form, databases: e.target.value })}
                placeholder={'One per line, e.g.\nMySQL — vtigercrm (410MB)'}
              />
            </div>
            <div className="srv-field">
              <label>What&apos;s on it</label>
              <textarea value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="Apps, sites, services found during investigation" />
            </div>
            <div className="srv-field">
              <label>Backup location / notes</label>
              <input value={form.backup} onChange={(e) => setForm({ ...form, backup: e.target.value })} placeholder="e.g. Google Drive link, or 'no backup needed'" />
            </div>
            <div className="modal-actions">
              <button className="btn-primary" disabled={saving} onClick={handleAdd}>
                {saving ? 'Adding…' : 'Add to board'}
              </button>
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div
          className="modal-bg"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <div className="modal srv-modal-wide">
            <h2>{detail.name || 'Unnamed'}</h2>
            <p className="srv-mono-sub">
              {detail.ip || '—'}
              {detail.hostname ? ` · ${detail.hostname}` : ''}
              {detail.os ? ` · ${detail.os}` : ''}
            </p>

            {(detail.linodeLabel || detail.plan || detail.region || detail.lastBackup) && (
              <div className="srv-detail-section">
                <h4>Linode fleet info</h4>
                <p className="srv-detail-text">
                  {detail.linodeLabel && (
                    <>
                      Label: {detail.linodeLabel}
                      <br />
                    </>
                  )}
                  {detail.plan && (
                    <>
                      Plan: {detail.plan}
                      <br />
                    </>
                  )}
                  {detail.region && (
                    <>
                      Region: {detail.region}
                      <br />
                    </>
                  )}
                  {detail.lastBackup && <>Last backup: {detail.lastBackup}</>}
                </p>
              </div>
            )}

            {!!(detail.websites && detail.websites.length) && (
              <div className="srv-detail-section">
                <h4>Websites hosted here</h4>
                <div className="srv-chips">
                  {detail.websites.map((w, i) => {
                    const href = siteHref(w);
                    return href ? (
                      <a key={i} className="srv-chip" href={href} target="_blank" rel="noopener noreferrer">
                        {w}
                      </a>
                    ) : (
                      <span key={i} className="srv-chip">{w}</span>
                    );
                  })}
                </div>
              </div>
            )}

            {!!(detail.databases && detail.databases.length) && (
              <div className="srv-detail-section">
                <h4>Databases (SQL) on this server</h4>
                <div className="srv-chips">
                  {detail.databases.map((d, i) => (
                    <span key={i} className="srv-chip db">🗄 {d}</span>
                  ))}
                </div>
              </div>
            )}

            {!!(detail.findings && detail.findings.length) && (
              <div className="srv-detail-section">
                <h4>What&apos;s on it</h4>
                <ul className="srv-findings">
                  {detail.findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {detail.desc && (!detail.findings || !detail.findings.length) && (
              <div className="srv-detail-section">
                <h4>What&apos;s on it</h4>
                <p className="srv-detail-text">{detail.desc}</p>
              </div>
            )}

            {(detail.disk || detail.mem) && (
              <div className="srv-detail-section">
                <h4>Resources</h4>
                <p className="srv-detail-text">
                  {detail.disk && `Disk: ${detail.disk}`}
                  {detail.disk && detail.mem && ' · '}
                  {detail.mem && `Memory: ${detail.mem}`}
                </p>
              </div>
            )}

            {detail.backup && (
              <div className="srv-detail-section">
                <h4>Backup</h4>
                <p className="srv-detail-text" style={{ whiteSpace: 'pre-wrap' }}>{detail.backup}</p>
              </div>
            )}

            {detail.flagNote && <div className="srv-flag-note" style={{ marginBottom: 16 }}>⚠ {detail.flagNote}</div>}

            <div className="srv-field">
              <label>Status</label>
              <select value={detailStatus} onChange={(e) => setDetailStatus(e.target.value as ServerStatus)}>
                <option value="active">Active — not yet reviewed</option>
                <option value="flagged">Flagged — do not delete</option>
                <option value="ready">Ready to delete</option>
                <option value="done">Decommissioned</option>
              </select>
            </div>
            <div className="srv-field">
              <label>Websites hosted here</label>
              <textarea value={detailWebsites} onChange={(e) => setDetailWebsites(e.target.value)} placeholder="One per line, e.g. copyworldinc.com" />
            </div>
            <div className="srv-field">
              <label>Databases (SQL) on this server</label>
              <textarea value={detailDatabases} onChange={(e) => setDetailDatabases(e.target.value)} placeholder="One per line, e.g. MySQL — vtigercrm (410MB)" />
            </div>
            <div className="srv-field">
              <label>Notes</label>
              <textarea value={detailNotes} onChange={(e) => setDetailNotes(e.target.value)} placeholder="Add a note..." />
            </div>
            <p className="srv-updated">
              Last updated{' '}
              {detail.updatedAt
                ? new Date(detail.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : ''}
            </p>
            <div className="modal-actions">
              <button className="btn-primary" disabled={detailSaving} onClick={handleDetailSave}>
                {detailSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button className="btn-ghost" onClick={() => setDetail(null)}>
                Close
              </button>
              <button className="btn-danger" onClick={handleDetailDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
