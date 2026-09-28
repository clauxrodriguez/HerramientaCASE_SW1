const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:3001'
  : 'https://case-backend-1qbr.onrender.com';

export const API_BASE = (configuredApiUrl || defaultApiUrl).replace(/\/$/, '');

export function apiPath(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
