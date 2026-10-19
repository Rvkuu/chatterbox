import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { generalMessage } from './errors';

interface HeaderProps {
  onShowLogin: () => void;
  onShowRegister: () => void;
  onShowHome: () => void;
}

export function Header({ onShowLogin, onShowRegister, onShowHome }: HeaderProps) {
  const { state, logout } = useAuth();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    setError(undefined);
    try {
      await logout();
      onShowHome();
    } catch (err) {
      setError(generalMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="site-header">
      <h1>
        <button type="button" className="brand" onClick={onShowHome}>
          Chatterbox
        </button>
      </h1>
      <nav aria-label="Account">
        {state.status === 'authenticated' ? (
          <>
            <span className="signed-in">
              Signed in as <strong>{state.user.username}</strong>
            </span>
            <button type="button" onClick={() => void handleLogout()} disabled={busy}>
              Log out
            </button>
          </>
        ) : null}
        {state.status === 'anonymous' ? (
          <>
            <button type="button" onClick={onShowLogin}>
              Log in
            </button>
            <button type="button" onClick={onShowRegister}>
              Register
            </button>
          </>
        ) : null}
      </nav>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </header>
  );
}
