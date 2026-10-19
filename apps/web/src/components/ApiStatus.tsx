import { useEffect, useState } from 'react';
import { fetchHealth } from '../api/endpoints';

type Status = 'checking' | 'ok' | 'unreachable';

// A small indicator of whether the API answers. It is also what the first smoke tests check.
export function ApiStatus() {
  const [status, setStatus] = useState<Status>('checking');

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

  return <p className="api-status">API status: {status}</p>;
}
