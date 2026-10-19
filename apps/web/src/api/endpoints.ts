import { ApiRequestError, getJson, postJson, resetCsrfToken } from './client';

export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface Post {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string };
}

export interface HealthResponse {
  status: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  username: string;
}

export function fetchHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>('/health');
}

// Asks whether a session exists. No session is a normal answer (null), not an error.
export async function getCurrentUser(): Promise<User | null> {
  try {
    return (await getJson<{ user: User }>('/auth/me')).user;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) {
      return null;
    }
    throw err;
  }
}

// Registering creates the account only. The caller then logs in (docs/api.md).
export async function register(input: Registration): Promise<User> {
  return (await postJson<{ user: User }>('/auth/register', input)).user;
}

export async function login(input: Credentials): Promise<User> {
  const { user } = await postJson<{ user: User }>('/auth/login', input);
  resetCsrfToken();
  return user;
}

export async function logout(): Promise<void> {
  try {
    await postJson('/auth/logout');
  } finally {
    resetCsrfToken();
  }
}

export async function getPosts(): Promise<Post[]> {
  return (await getJson<{ posts: Post[] }>('/posts')).posts;
}

export async function createPost(content: string): Promise<Post> {
  return (await postJson<{ post: Post }>('/posts', { content })).post;
}
