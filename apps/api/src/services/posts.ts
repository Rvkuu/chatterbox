import type { Db } from '../db.js';
import { unauthenticated } from '../errors.js';
import { Prisma } from '../generated/prisma/client.js';

// The only shape of a post that leaves the API (docs/api.md section 3): the author's public
// username and id, never an email or any password data.
export interface PublicPost {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string };
}

const WITH_AUTHOR = { author: { select: { id: true, username: true } } } as const;

interface PostRow {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; username: string };
}

function toPublicPost(post: PostRow): PublicPost {
  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: { id: post.author.id, username: post.author.username },
  };
}

// D5: the feed is the newest 100 posts, no pagination in the MVP.
export const FEED_LIMIT = 100;

export interface PostsService {
  feed: () => Promise<PublicPost[]>;
  create: (authorId: string, content: string) => Promise<PublicPost>;
}

export function createPostsService(db: Db): PostsService {
  return {
    // Newest first. The id breaks ties, so two posts with the same timestamp always come back in
    // the same order (docs/database.md section 5, AT-F3).
    async feed() {
      const rows = await db.post.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: FEED_LIMIT,
        include: WITH_AUTHOR,
      });
      return rows.map(toPublicPost);
    },

    // The author is whoever the session says, never anything from the request (FR-05.3). The
    // timestamp comes from the database clock (FR-05.4).
    async create(authorId, content) {
      try {
        const row = await db.post.create({ data: { authorId, content }, include: WITH_AUTHOR });
        return toPublicPost(row);
      } catch (err) {
        // P2003: the session points at a user that no longer exists.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
          throw unauthenticated();
        }
        throw err;
      }
    },
  };
}
