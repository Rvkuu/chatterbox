import { useEffect, useState } from 'react';
import { getPosts } from '../api/endpoints';
import type { Post } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { Composer } from './Composer';
import { generalMessage } from './errors';
import { PostList } from './PostList';

type FeedState =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; posts: Post[] };

interface FeedProps {
  onSessionExpired: () => void;
}

// The shared feed (FR-04) and, for a logged-in user, the composer (FR-05). Every state of the
// data is shown: loading, error with a retry, empty, and the list.
export function Feed({ onSessionExpired }: FeedProps) {
  const { state: auth, sessionExpired } = useAuth();
  const [feed, setFeed] = useState<FeedState>({ status: 'loading' });
  // Changing this number fetches the feed again (the "Try again" button).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // If the component goes away before the answer arrives, do not update it.
    let cancelled = false;
    getPosts().then(
      (posts) => {
        if (!cancelled) setFeed({ status: 'ready', posts });
      },
      (err: unknown) => {
        if (!cancelled) setFeed({ status: 'error', message: generalMessage(err) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setFeed({ status: 'loading' });
    setAttempt((current) => current + 1);
  }

  function handleCreated(post: Post) {
    // The new post goes to the top without reloading the feed (FR-05.6).
    setFeed((current) =>
      current.status === 'ready' ? { status: 'ready', posts: [post, ...current.posts] } : current,
    );
  }

  function handleExpired() {
    sessionExpired();
    onSessionExpired();
  }

  return (
    <section aria-labelledby="feed-heading">
      <h2 id="feed-heading">Latest posts</h2>
      {auth.status === 'authenticated' ? (
        <Composer onCreated={handleCreated} onSessionExpired={handleExpired} />
      ) : null}
      {feed.status === 'loading' ? (
        <p className="state-message" role="status">
          Loading posts…
        </p>
      ) : null}
      {feed.status === 'error' ? (
        <div className="state-message" role="alert">
          <p>{feed.message}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      ) : null}
      {feed.status === 'ready' && feed.posts.length === 0 ? (
        <p className="state-message">
          No posts yet.{' '}
          {auth.status === 'authenticated'
            ? 'Write the first one above.'
            : 'Log in to write the first one.'}
        </p>
      ) : null}
      {feed.status === 'ready' && feed.posts.length > 0 ? <PostList posts={feed.posts} /> : null}
    </section>
  );
}
