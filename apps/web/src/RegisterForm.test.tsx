import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './auth/AuthContext';
import { RegisterForm } from './components/RegisterForm';
import { anonymous, apiError, json, mockApi } from './test/mockApi';

const VALID = {
  email: 'ada@example.com',
  username: 'ada_l',
  password: 'correct horse battery staple',
};

function setup(routes = {}) {
  const api = mockApi({ ...anonymous, ...routes });
  const onRegistered = vi.fn();
  const user = userEvent.setup();
  render(
    <AuthProvider>
      <RegisterForm onRegistered={onRegistered} onShowLogin={() => undefined} />
    </AuthProvider>,
  );
  return { api, onRegistered, user };
}

async function fill(user: ReturnType<typeof userEvent.setup>, values: Partial<typeof VALID>) {
  const v = { ...VALID, ...values };
  await user.type(screen.getByLabelText('Email'), v.email);
  await user.type(screen.getByLabelText('Username'), v.username);
  await user.type(screen.getByLabelText('Password'), v.password);
}

describe('RegisterForm', () => {
  it('AT-R4: shows a message at every empty field and sends no request', async () => {
    const { api, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Must be 3 to 30 characters.')).toBeInTheDocument();
    expect(screen.getByText('Must be 12 to 128 characters.')).toBeInTheDocument();
    expect(api.called('POST /auth/register')).toHaveLength(0);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    ['an email with no @', { email: 'ada.example.com' }, 'Must be a valid email address.'],
    [
      'a username with a hyphen',
      { username: 'ada-l' },
      'Use only letters, numbers and underscores.',
    ],
    ['a 2 character username', { username: 'ab' }, 'Must be 3 to 30 characters.'],
    ['an 11 character password', { password: 'x'.repeat(11) }, 'Must be 12 to 128 characters.'],
  ])('AT-R4: shows the right message for %s', async (_name, change, message) => {
    const { api, user } = setup();
    await fill(user, change);

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(api.called('POST /auth/register')).toHaveLength(0);
  });

  it('AT-R1: registers, sends trimmed values, and reports success with the email', async () => {
    const { api, onRegistered, user } = setup({
      'POST /auth/register': json(201, {
        user: { id: 'u1', username: 'ada_l', createdAt: '2026-10-16T11:19:54.000Z' },
      }),
    });
    await fill(user, { email: '  ada@example.com ', username: ' ada_l ' });

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith('ada@example.com'));
    expect(api.called('POST /auth/register')[0]?.body).toEqual(VALID);
  });

  it('AT-R6: shows the email message from a 409 at the email field', async () => {
    const { user } = setup({
      'POST /auth/register': apiError(409, 'CONFLICT', 'Could not create the account.', {
        email: ['Already registered.'],
      }),
    });
    await fill(user, {});

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const message = await screen.findByText('Already registered.');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(message.textContent ?? '');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Username')).not.toHaveAttribute('aria-invalid');
  });

  it('AT-R10: shows the username message from a 400 next to the username field', async () => {
    const { user } = setup({
      'POST /auth/register': apiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', {
        username: ['Unknown thing about the username.'],
      }),
    });
    await fill(user, {});

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Unknown thing about the username.')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
  });

  it('AT-R10: shows a general message when the network fails, and keeps what was typed', async () => {
    const { user } = setup({
      'POST /auth/register': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await fill(user, {});

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
    expect(screen.getByLabelText('Email')).toHaveValue(VALID.email);
    expect(screen.getByLabelText('Password')).toHaveValue(VALID.password);
  });

  it('AT-R10: the button cannot be used twice while a request is in flight', async () => {
    let finish: () => void = () => undefined;
    const { api, user } = setup({
      'POST /auth/register': () =>
        new Promise((resolve) => {
          finish = () =>
            resolve(json(201, { user: { id: 'u1', username: 'ada_l', createdAt: 'x' } }));
        }),
    });
    await fill(user, {});

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    const busy = await screen.findByRole('button', { name: 'Creating account…' });
    expect(busy).toBeDisabled();
    await user.click(busy);
    await user.keyboard('{Enter}');

    finish();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled(),
    );
    expect(api.called('POST /auth/register')).toHaveLength(1);
  });
});
