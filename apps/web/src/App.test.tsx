import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { ADA, anonymous, apiError, json, mockApi } from './test/mockApi';

const LOGGED_IN = { 'GET /auth/me': json(200, { user: ADA }) };

describe('App: scaffold', () => {
  it('scaffold: shows the application name and a checking state at first', () => {
    mockApi({ ...anonymous, 'GET /health': () => new Promise(() => undefined) });
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Chatterbox' })).toBeInTheDocument();
    expect(screen.getByText('API status: checking')).toBeInTheDocument();
  });

  it('scaffold: shows ok when the health check succeeds', async () => {
    mockApi({ ...anonymous });
    render(<App />);

    expect(await screen.findByText('API status: ok')).toBeInTheDocument();
  });

  it('scaffold: shows unreachable when the request fails', async () => {
    mockApi({
      ...anonymous,
      'GET /health': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    render(<App />);

    expect(await screen.findByText('API status: unreachable')).toBeInTheDocument();
  });

  it('scaffold: shows unreachable when the API answers with an error status', async () => {
    mockApi({ ...anonymous, 'GET /health': apiError(503, 'SERVICE_UNAVAILABLE', 'Down.') });
    render(<App />);

    expect(await screen.findByText('API status: unreachable')).toBeInTheDocument();
  });
});

describe('App: authentication', () => {
  it('AT-L5: with a session on load, shows the logged-in state and no login or register buttons', async () => {
    mockApi(LOGGED_IN);
    render(<App />);

    expect(await screen.findByText('ada_l')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
  });

  it('AT-L5: without a session on load, shows the logged-out state', async () => {
    mockApi(anonymous);
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });

  it('AT-L5: shows neither state while it is still asking the server', () => {
    mockApi({ 'GET /auth/me': () => new Promise(() => undefined) });
    render(<App />);

    expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });

  it('AT-L5: if the API cannot be reached on load, the visitor is shown logged out', async () => {
    mockApi({
      'GET /auth/me': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('AT-R1: registering leads to the login form with a notice and the email filled in', async () => {
    mockApi({
      ...anonymous,
      'POST /auth/register': json(201, { user: ADA }),
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Register' }));
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Username'), 'ada_l');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Account created. Please log in.');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('AT-L1: logging in shows the logged-in state', async () => {
    mockApi({ ...anonymous, 'POST /auth/login': json(200, { user: ADA }) });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Log in' }));
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery staple');
    const form = screen.getByRole('region', { name: 'Log in' });
    await user.click(within(form).getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('ada_l')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('AT-O4: logging out returns to the logged-out state, and a reload stays logged out', async () => {
    const api = mockApi({ ...LOGGED_IN, 'POST /auth/logout': { status: 204 } });
    const user = userEvent.setup();
    const first = render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
    expect(api.called('POST /auth/logout')).toHaveLength(1);

    // After a reload the server no longer knows the session.
    first.unmount();
    mockApi(anonymous);
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('AT-O4: shows a message and stays logged in if the logout request fails', async () => {
    mockApi({
      ...LOGGED_IN,
      'POST /auth/logout': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
    expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled();
    await waitFor(() => expect(screen.getByText('ada_l')).toBeInTheDocument());
  });
});
