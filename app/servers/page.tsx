import { Suspense } from 'react';
import Dashboard from '@/components/Dashboard';

// Lets people bookmark/link directly to https://sprint.birbals.com/servers
// instead of only reaching the Servers tab by clicking it from "/".
export default function ServersPage() {
  return (
    <Suspense fallback={
      <div className="spinner-wrap" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <div className="spinner-label">Loading…</div>
      </div>
    }>
      <Dashboard initialTab="servers" />
    </Suspense>
  );
}
