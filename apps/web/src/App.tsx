import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ApiStatus } from './components/ApiStatus';
import { Feed } from './components/Feed';
import { Header } from './components/Header';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';

type View = 'home' | 'login' | 'register';

function Shell() {
  const { state } = useAuth();
  const [view, setView] = useState<View>('home');
  const [notice, setNotice] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();

  const showLogin = () => {
    setNotice(undefined);
    setView('login');
  };
  const showRegister = () => setView('register');
  const showHome = () => setView('home');

  // A logged-in user has no reason to see the login or register forms.
  const current: View = state.status === 'authenticated' ? 'home' : view;

  return (
    <>
      <Header onShowLogin={showLogin} onShowRegister={showRegister} onShowHome={showHome} />
      <main>
        {current === 'login' ? (
          <LoginForm
            notice={notice}
            defaultEmail={email}
            onLoggedIn={showHome}
            onShowRegister={showRegister}
          />
        ) : null}
        {current === 'register' ? (
          <RegisterForm
            onRegistered={(registeredEmail) => {
              // Registering does not log in, so the next step is the login form (docs/api.md).
              setEmail(registeredEmail);
              setNotice('Account created. Please log in.');
              setView('login');
            }}
            onShowLogin={showLogin}
          />
        ) : null}
        {current === 'home' ? (
          <Feed
            onSessionExpired={() => {
              // The server no longer knows this session (it expired), so ask the user to log in.
              setNotice('Your session has expired. Please log in again.');
              setView('login');
            }}
          />
        ) : null}
      </main>
      <footer>
        <ApiStatus />
      </footer>
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
