// Where the API lives. By default it is /api on the same origin as the page (ADR-0006).
export const apiBaseUrl: string = import.meta.env.VITE_API_URL ?? '/api';
