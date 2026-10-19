import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { type Errors, validateEmail } from '../validation';
import { generalMessage } from './errors';
import { FormField } from './FormField';

type Field = 'email' | 'password';

interface LoginFormProps {
  notice?: string | undefined;
  defaultEmail?: string | undefined;
  onLoggedIn: () => void;
  onShowRegister: () => void;
}

export function LoginForm({
  notice,
  defaultEmail = '',
  onLoggedIn,
  onShowRegister,
}: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors<Field>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const found: Errors<Field> = {};
    const emailError = validateEmail(email);
    if (emailError) found.email = emailError;
    // A short password is simply a wrong password, so only emptiness is checked here. The password
    // rules are not repeated at login (docs/api.md).
    if (password === '') found.password = 'Enter your password.';
    setErrors(found);
    setFormError(undefined);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      onLoggedIn();
    } catch (err) {
      // Wrong password and unknown email get the same single message from the server (FR-02.4).
      setFormError(generalMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="login-heading">
      <h2 id="login-heading">Log in</h2>
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <FormField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <FormField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        {formError ? (
          <p className="error" role="alert">
            {formError}
          </p>
        ) : null}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p>
        New here?{' '}
        <button type="button" className="link" onClick={onShowRegister}>
          Create an account
        </button>
      </p>
    </section>
  );
}
