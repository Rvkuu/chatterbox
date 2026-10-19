import type { Post } from '../api/endpoints';

const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// Posts arrive newest first and are shown in that order. The content is rendered as plain text:
// React escapes it, and nothing here uses dangerouslySetInnerHTML (docs/security.md section 8).
export function PostList({ posts }: { posts: Post[] }) {
  return (
    <ol className="post-list">
      {posts.map((post) => (
        <li key={post.id} className="post">
          <p className="post-meta">
            <span className="post-author">{post.author.username}</span>
            <time className="post-time" dateTime={post.createdAt}>
              {formatter.format(new Date(post.createdAt))}
            </time>
          </p>
          <p className="post-content">{post.content}</p>
        </li>
      ))}
    </ol>
  );
}
