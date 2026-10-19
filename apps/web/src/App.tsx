import { useEffect, useState } from 'react';
import { fetchHealth } from './api';

type ApiStatus = 'checking' | 'ok' | 'unreachable';

export function App() {
  const [status, setStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    // If the component goes away before the answer arrives, do not update it.
    let cancelled = false;
    fetchHealth()
      .then(() => {
        if (!cancelled) setStatus('ok');
      })
      .catch(() => {
        if (!cancelled) setStatus('unreachable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>Chatterbox</h1>
      <p>API status: {status}</p>
    </main>
  );
}
