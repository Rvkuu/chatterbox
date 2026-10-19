import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as api from '../api/endpoints';
import type { Credentials, Registration, User } from '../api/endpoints';

type AuthState =
  { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; user: User };

interface AuthContextValue {
  state: AuthState;
  register: (input: Registration) => Promise<void>;
  login: (input: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  // Called when the server says the session is gone (for example it expired).
  sessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// The server decides who is logged in. The browser asks once on load (GET /auth/me) and then
// follows what login and logout report (docs/architecture.md section 6).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api
      .getCurrentUser()
      .then((user) => {
        if (!cancelled)
          setState(user ? { status: 'authenticated', user } : { status: 'anonymous' });
      })
      .catch(() => {
        // If the API cannot be reached the visitor can still read the page, logged out.
        if (!cancelled) setState({ status: 'anonymous' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async (input: Registration) => {
    await api.register(input);
  }, []);

  const login = useCallback(async (input: Credentials) => {
    const user = await api.login(input);
    setState({ status: 'authenticated', user });
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setState({ status: 'anonymous' });
  }, []);

  const sessionExpired = useCallback(() => setState({ status: 'anonymous' }), []);

  const value = useMemo(
    () => ({ state, register, login, logout, sessionExpired }),
    [state, register, login, logout, sessionExpired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === undefined) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return value;
}
