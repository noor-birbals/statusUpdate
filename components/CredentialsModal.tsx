'use client';

import { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  email: string;
  onClose: () => void;
  onSave: (email: string, token: string) => void;
}

export default function CredentialsModal({ open, email, onClose, onSave }: Props) {
  const [inputEmail, setInputEmail] = useState(email);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setInputEmail(email);
      setToken('');
      setError('');
    }
  }, [open, email]);

  if (!open) return null;

  function handleSave() {
    const trimmedEmail = inputEmail.trim();
    const trimmedToken = token.trim();
    if (!trimmedEmail || !trimmedToken) {
      setError('Please fill in both fields.');
      return;
    }
    setError('');
    onSave(trimmedEmail, trimmedToken);
  }

  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>Connect to Jira</h2>
        <p>
          Enter your Atlassian email and API token. These are stored only in your
          browser&apos;s local storage and sent directly to Jira via this server.
        </p>
        {error && <div className="modal-error">{error}</div>}
        <label>Atlassian Email</label>
        <input
          type="email"
          value={inputEmail}
          onChange={(e) => setInputEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
        />
        <label>API Token</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your API token here"
        />
        <div className="token-help">
          Don&apos;t have a token?{' '}
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
          >
            Generate one here
          </a>{' '}
          → Create API token → Copy.
        </div>
        <div className="modal-actions">
          <button className="btn-primary" onClick={handleSave}>
            Connect &amp; Load Dashboard
          </button>
          {email && (
            <button className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
