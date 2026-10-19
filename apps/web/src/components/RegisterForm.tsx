import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { type Errors, validateEmail, validateNewPassword, validateUsername } from '../validation';
import { firstMessage, generalMessage } from './errors';
import { FormField } from './FormField';

type Field = 'email' | 'username' | 'password';

interface RegisterFormProps {
  onRegistered: (email: string) => void;
  onShowLogin: () => void;
}

export function RegisterForm({ onRegistered, onShowLogin }: RegisterFormProps) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors<Field>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const found: Errors<Field> = {};
    const emailError = validateEmail(email);
    const usernameError = validateUsername(username);
    const passwordError = validateNewPassword(password);
    if (emailError) found.email = emailError;
    if (usernameError) found.username = usernameError;
    if (passwordError) found.password = passwordError;
    setErrors(found);
    setFormError(undefined);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await register({ email: email.trim(), username: username.trim(), password });
      onRegistered(email.trim());
    } catch (err) {
      // The server checks everything again, so its field messages are shown next to the fields.
      if (err instanceof ApiRequestError && err.fields) {
        const fromServer: Errors<Field> = {};
        for (const field of ['email', 'username', 'password'] as const) {
          const message = firstMessage(err.fields, field);
          if (message) fromServer[field] = message;
        }
        if (Object.keys(fromServer).length > 0) {
          setErrors(fromServer);
          return;
        }
      }
      setFormError(generalMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="register-heading">
      <h2 id="register-heading">Create an account</h2>
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <FormField
          id="register-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <FormField
          id="register-username"
          label="Username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          error={errors.username}
          hint="3 to 30 letters, numbers or underscores. This is shown on your posts."
        />
        <FormField
          id="register-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          hint="12 to 128 characters."
        />
        {formError ? (
          <p className="error" role="alert">
            {formError}
          </p>
        ) : null}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p>
        Already have an account?{' '}
        <button type="button" className="link" onClick={onShowLogin}>
          Log in
        </button>
      </p>
    </section>
  );
}
