import { Suspense } from 'react';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  return (
    <Suspense fallback={
      <div className="spinner-wrap" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <div className="spinner-label">Loading…</div>
      </div>
    }>
      <Dashboard />
    </Suspense>
  );
}
