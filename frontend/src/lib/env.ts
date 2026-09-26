const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!raw) {
  throw new Error('Missing VITE_API_BASE_URL. Copy .env.example to .env before running the app.');
}

/** Base URL of the backend API, e.g. http://localhost:3000/api/v1 (no trailing slash). */
export const API_BASE_URL = raw.replace(/\/+$/, '');
