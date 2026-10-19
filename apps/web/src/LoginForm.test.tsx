import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './auth/AuthContext';
import { LoginForm } from './components/LoginForm';
import { ADA, anonymous, apiError, json, mockApi } from './test/mockApi';

const INVALID = apiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');

function setup(routes = {}) {
  const api = mockApi({ ...anonymous, ...routes });
  const onLoggedIn = vi.fn();
  const user = userEvent.setup();
  render(
    <AuthProvider>
      <LoginForm onLoggedIn={onLoggedIn} onShowRegister={() => undefined} />
    </AuthProvider>,
  );
  return { api, onLoggedIn, user };
}

async function submit(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('LoginForm', () => {
  it('AT-L1: logs in with the typed credentials and reports success', async () => {
    const { api, onLoggedIn, user } = setup({ 'POST /auth/login': json(200, { user: ADA }) });

    await submit(user, ' ada@example.com ', 'correct horse battery staple');

    await vi.waitFor(() => expect(onLoggedIn).toHaveBeenCalled());
    expect(api.called('POST /auth/login')[0]?.body).toEqual({
      email: 'ada@example.com',
      password: 'correct horse battery staple',
    });
  });

  it('AT-L3: shows the same single message for a wrong password and for an unknown email', async () => {
    const wrongPassword = setup({ 'POST /auth/login': INVALID });
    await submit(wrongPassword.user, 'ada@example.com', 'not the right password');
    const first = (await screen.findByRole('alert')).textContent;
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(wrongPassword.onLoggedIn).not.toHaveBeenCalled();
    document.body.innerHTML = '';

    const unknownEmail = setup({ 'POST /auth/login': INVALID });
    await submit(unknownEmail.user, 'nobody@example.com', 'not the right password');
    const second = (await screen.findByRole('alert')).textContent;

    expect(first).toBe('Email or password is incorrect.');
    expect(second).toBe(first);
  });

  it('extra: asks for both fields before sending anything', async () => {
    const { api, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(api.called('POST /auth/login')).toHaveLength(0);
  });

  it('extra: does not apply the password length rules to a login', async () => {
    const { api, user } = setup({ 'POST /auth/login': INVALID });

    await submit(user, 'ada@example.com', 'short');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(api.called('POST /auth/login')).toHaveLength(1);
  });

  it('extra: shows a general message when the network fails', async () => {
    const { user } = setup({
      'POST /auth/login': () => {
        throw new TypeError('Failed to fetch');
      },
    });

    await submit(user, 'ada@example.com', 'correct horse battery staple');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  });

  it('extra: shows a message when the service is unavailable', async () => {
    const { user } = setup({ 'POST /auth/login': apiError(503, 'SERVICE_UNAVAILABLE', 'Down.') });

    await submit(user, 'ada@example.com', 'correct horse battery staple');

    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
  });
});
