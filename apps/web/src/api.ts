import { apiBaseUrl } from './config';

export interface HealthResponse {
  status: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${apiBaseUrl}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}.`);
  }
  return (await res.json()) as HealthResponse;
}
