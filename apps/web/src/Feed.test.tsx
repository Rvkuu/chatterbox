import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { ADA, anonymous, apiError, json, mockApi, post } from './test/mockApi';

const LOGGED_IN = { 'GET /auth/me': json(200, { user: ADA }) };

describe('Feed', () => {
  it('AT-F2: renders the posts in the order the API returns them, newest first', async () => {
    mockApi({
      ...anonymous,
      'GET /posts': json(200, {
        posts: [
          post('p3', 'third', 'ada_l', '2026-10-16T12:00:00.000Z'),
          post('p2', 'second', 'grace_h', '2026-10-16T11:00:00.000Z'),
          post('p1', 'first', 'ada_l', '2026-10-16T10:00:00.000Z'),
        ],
      }),
    });
    render(<App />);

    const items = await screen.findAllByRole('listitem');

    expect(
      items.map((item) => within(item).getByText(/^(first|second|third)$/).textContent),
    ).toEqual(['third', 'second', 'first']);
  });

  it('AT-F4: each post shows the author, the content and a readable date and time', async () => {
    mockApi({
      ...anonymous,
      'GET /posts': json(200, {
        posts: [post('p1', 'Hello, Chatterbox!', 'ada_l', '2026-10-16T12:00:00.000Z')],
      }),
    });
    render(<App />);

    const item = await screen.findByRole('listitem');

    expect(within(item).getByText('ada_l')).toBeInTheDocument();
    expect(within(item).getByText('Hello, Chatterbox!')).toBeInTheDocument();
    const time = item.querySelector('time');
    expect(time).toHaveAttribute('datetime', '2026-10-16T12:00:00.000Z');
    expect(time?.textContent).toMatch(/2026/);
  });

  it('AT-F6: shows an empty state when there are no posts, with a hint for visitors', async () => {
    mockApi({ ...anonymous, 'GET /posts': json(200, { posts: [] }) });
    render(<App />);

    expect(await screen.findByText(/No posts yet\./)).toHaveTextContent(
      'Log in to write the first one.',
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('AT-F6: the empty state points a logged-in user at the composer', async () => {
    mockApi({ ...LOGGED_IN, 'GET /posts': json(200, { posts: [] }) });
    render(<App />);

    expect(await screen.findByText(/No posts yet\./)).toHaveTextContent(
      'Write the first one above.',
    );
  });

  it('AT-F7: shows a loading indicator until the data arrives, then removes it', async () => {
    let arrive: () => void = () => undefined;
    mockApi({
      ...anonymous,
      'GET /posts': () =>
        new Promise((resolve) => {
          arrive = () => resolve(json(200, { posts: [post('p1', 'finally here')] }));
        }),
    });
    render(<App />);

    expect(await screen.findByText('Loading posts…')).toBeInTheDocument();
    expect(screen.queryByText('finally here')).not.toBeInTheDocument();

    arrive();

    expect(await screen.findByText('finally here')).toBeInTheDocument();
    expect(screen.queryByText('Loading posts…')).not.toBeInTheDocument();
  });

  it.each([
    [
      'a 500 error',
      () => apiError(500, 'INTERNAL_ERROR', 'Something went wrong.'),
      'Something went wrong',
    ],
    ['a 503 error', () => apiError(503, 'SERVICE_UNAVAILABLE', 'Down.'), 'temporarily unavailable'],
    [
      'an unreachable API',
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Could not reach the server',
    ],
  ])(
    'AT-F8: %s shows a message and a retry action, and retrying loads the feed',
    async (_name, failure, text) => {
      let healthy = false;
      mockApi({
        ...anonymous,
        'GET /posts': () =>
          healthy ? json(200, { posts: [post('p1', 'back again')] }) : failure(),
      });
      const user = userEvent.setup();
      render(<App />);

      const alert = await screen.findByText(new RegExp(text));
      expect(alert).toBeInTheDocument();
      // The rest of the page still works: the header is there and nothing crashed.
      expect(screen.getByRole('heading', { name: 'Chatterbox' })).toBeInTheDocument();

      healthy = true;
      await user.click(screen.getByRole('button', { name: 'Try again' }));

      expect(await screen.findByText('back again')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    },
  );

  it('AT-P8: shows post content as literal text, and creates no script or b element', async () => {
    const hostile = '<script>alert(1)</script><b>x</b>';
    mockApi({ ...anonymous, 'GET /posts': json(200, { posts: [post('p1', hostile)] }) });
    const { container } = render(<App />);

    expect(await screen.findByText(hostile)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('li b')).toBeNull();
  });
});

describe('Composer', () => {
  it('AT-P2: visitors do not see the composer', async () => {
    mockApi(anonymous);
    render(<App />);

    await screen.findByRole('button', { name: 'Log in' });
    expect(screen.queryByLabelText('What is on your mind?')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post' })).not.toBeInTheDocument();
  });

  it('AT-P1: a logged-in user posts, and the post appears at the top without a reload', async () => {
    const api = mockApi({
      ...LOGGED_IN,
      'GET /posts': json(200, { posts: [post('p1', 'older post', 'grace_h')] }),
      'POST /posts': json(201, { post: post('p2', 'Hello, Chatterbox!', 'ada_l') }),
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('What is on your mind?'), 'Hello, Chatterbox!');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Hello, Chatterbox!');
    expect(items[1]).toHaveTextContent('older post');
    expect(screen.getByLabelText('What is on your mind?')).toHaveValue('');
    expect(api.called('POST /posts')[0]?.body).toEqual({ content: 'Hello, Chatterbox!' });
    // The list was not fetched again.
    expect(api.called('GET /posts')).toHaveLength(1);
  });

  it('AT-P3: blank content shows a message and sends nothing', async () => {
    const api = mockApi(LOGGED_IN);
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('What is on your mind?'), '    ');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Write something first.')).toBeInTheDocument();
    expect(api.called('POST /posts')).toHaveLength(0);
  });

  it('AT-P9: content over 280 characters shows a message, a red counter, and keeps the text', async () => {
    const api = mockApi(LOGGED_IN);
    const user = userEvent.setup();
    render(<App />);
    const box = await screen.findByLabelText('What is on your mind?');

    await user.click(box);
    await user.paste('a'.repeat(281));
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Must be at most 280 characters.')).toBeInTheDocument();
    expect(screen.getByText('281/280')).toHaveClass('over');
    expect(box).toHaveValue('a'.repeat(281));
    expect(api.called('POST /posts')).toHaveLength(0);
  });

  it('AT-P9: a failed request keeps the typed text and shows an error', async () => {
    mockApi({
      ...LOGGED_IN,
      'POST /posts': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('What is on your mind?'), 'do not lose me');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
    expect(screen.getByLabelText('What is on your mind?')).toHaveValue('do not lose me');
  });

  it('AT-P9: shows the server message when the server rejects the content', async () => {
    mockApi({
      ...LOGGED_IN,
      'POST /posts': apiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', {
        content: ['Must be 1 to 280 characters.'],
      }),
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('What is on your mind?'), 'something');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Must be 1 to 280 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText('What is on your mind?')).toHaveValue('something');
  });

  it('AT-P9: when the session has expired the client retries once, then returns to the logged-out state', async () => {
    let attempts = 0;
    const api = mockApi({
      ...LOGGED_IN,
      'POST /posts': () => {
        attempts++;
        return attempts === 1
          ? apiError(403, 'CSRF_INVALID', 'Verify failed.')
          : apiError(401, 'UNAUTHENTICATED', 'You need to log in.');
      },
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('What is on your mind?'), 'too late');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your session has expired. Please log in again.',
    );
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(api.called('POST /posts')).toHaveLength(2);
  });

  it('AT-P9: the counter counts characters, so an emoji is one', async () => {
    mockApi(LOGGED_IN);
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('What is on your mind?'), '🙂🙂🙂');

    expect(screen.getByText('3/280')).toBeInTheDocument();
  });

  it('AT-P9: the button cannot be used twice while the post is being sent', async () => {
    let finish: () => void = () => undefined;
    const api = mockApi({
      ...LOGGED_IN,
      'POST /posts': () =>
        new Promise((resolve) => {
          finish = () => resolve(json(201, { post: post('p1', 'once') }));
        }),
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('What is on your mind?'), 'once');
    await user.click(screen.getByRole('button', { name: 'Post' }));
    const busy = await screen.findByRole('button', { name: 'Posting…' });
    expect(busy).toBeDisabled();
    await user.click(busy);

    finish();
    await screen.findByText('once', { selector: '.post-content' });
    expect(api.called('POST /posts')).toHaveLength(1);
  });
});
