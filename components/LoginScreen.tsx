'use client';

interface Props {
  error?: string | null;
}

export default function LoginScreen({ error }: Props) {
  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>Sign in with Atlassian</h2>
        <p>
          Use your company Atlassian account to access sprint data. If your organisation
          uses SSO, you&apos;ll be redirected through your normal login flow.
        </p>
        {error && <div className="modal-error">{error}</div>}
        <a href="/api/auth/login" className="btn-primary btn-link">
          Continue with Atlassian
        </a>
        <div className="token-help" style={{ marginTop: 16 }}>
          Requires an OAuth app configured on the server. See <code>.env.example</code> for setup.
        </div>
      </div>
    </div>
  );
}
