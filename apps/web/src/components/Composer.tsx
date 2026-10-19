import { useState } from 'react';
import type { FormEvent } from 'react';
import { createPost } from '../api/endpoints';
import type { Post } from '../api/endpoints';
import { ApiRequestError } from '../api/client';
import { countCharacters, validatePostContent } from '../validation';
import { firstMessage, generalMessage } from './errors';

const MAX_LENGTH = 280;

interface ComposerProps {
  onCreated: (post: Post) => void;
  onSessionExpired: () => void;
}

export function Composer({ onCreated, onSessionExpired }: ComposerProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const length = countCharacters(content.trim());

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const problem = validatePostContent(content);
    setError(problem);
    if (problem) return;

    setSubmitting(true);
    try {
      const post = await createPost(content.trim());
      setContent('');
      onCreated(post);
    } catch (err) {
      // The typed text is kept so that nothing is lost when a request fails.
      if (err instanceof ApiRequestError && err.status === 401) {
        onSessionExpired();
        return;
      }
      if (err instanceof ApiRequestError && err.fields) {
        setError(firstMessage(err.fields, 'content') ?? generalMessage(err));
      } else {
        setError(generalMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="composer" onSubmit={(event) => void handleSubmit(event)} noValidate>
      <label htmlFor="post-content">What is on your mind?</label>
      <textarea
        id="post-content"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'post-content-error' : undefined}
      />
      {error ? (
        <p id="post-content-error" className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="composer-footer">
        <span className={length > MAX_LENGTH ? 'counter over' : 'counter'}>
          {length}/{MAX_LENGTH}
        </span>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  );
}
