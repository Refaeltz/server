import { useEffect, useState } from 'react';

type Status = 'checking' | 'ok' | 'error';

interface Check {
  label: string;
  url: string;
}

const CHECKS: Check[] = [
  { label: 'Liveness',           url: '/api/health/live'  },
  { label: 'Readiness (MongoDB)', url: '/api/health/ready' },
];

export default function App() {
  const [statuses, setStatuses] = useState<Record<string, Status>>(
    Object.fromEntries(CHECKS.map(c => [c.label, 'checking'])),
  );

  useEffect(() => {
    CHECKS.forEach(({ label, url }) => {
      fetch(url)
        .then(r => setStatuses(prev => ({ ...prev, [label]: r.ok ? 'ok' : 'error' })))
        .catch(() => setStatuses(prev => ({ ...prev, [label]: 'error' })));
    });
  }, []);

  return (
    <div className="container">
      <h1>App</h1>

      <div className="card">
        <h2>Backend health</h2>
        {CHECKS.map(({ label }) => (
          <StatusRow key={label} label={label} status={statuses[label]} />
        ))}
      </div>

      <div className="card">
        <h2>Links</h2>
        <a href="/api/docs" target="_blank" rel="noreferrer">
          Swagger API docs →
        </a>
      </div>
    </div>
  );
}

function StatusRow({ label, status }: { label: string; status: Status }) {
  const icon  = status === 'checking' ? '⏳' : status === 'ok' ? '✅' : '❌';
  const color = status === 'checking' ? '#888' : status === 'ok' ? '#22c55e' : '#ef4444';

  return (
    <p style={{ color }}>
      {icon} <strong>{label}</strong>: {status}
    </p>
  );
}
