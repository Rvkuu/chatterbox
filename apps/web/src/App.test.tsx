import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Replaces the browser's fetch for one test, so no real network is used.
function stubFetch(result: () => Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(result));
}

describe('App', () => {
  it('scaffold: shows the application name and a checking state at first', () => {
    stubFetch(() => new Promise<Response>(() => undefined));
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Chatterbox' })).toBeInTheDocument();
    expect(screen.getByText('API status: checking')).toBeInTheDocument();
  });

  it('scaffold: shows ok when the health check succeeds', async () => {
    stubFetch(() => Promise.resolve(Response.json({ status: 'ok' })));
    render(<App />);
    expect(await screen.findByText('API status: ok')).toBeInTheDocument();
  });

  it('scaffold: shows unreachable when the request fails', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    render(<App />);
    expect(await screen.findByText('API status: unreachable')).toBeInTheDocument();
  });

  it('scaffold: shows unreachable when the API answers with an error status', async () => {
    stubFetch(() => Promise.resolve(Response.json({}, { status: 503 })));
    render(<App />);
    expect(await screen.findByText('API status: unreachable')).toBeInTheDocument();
  });
});
