import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ─── Dynamic API URL interceptor ────────────────────────────────────────────
// When hosted on GitHub Pages, relative /api/* calls must be redirected to the
// production backend on Render.  VITE_API_URL is injected at build time by the
// GitHub Actions workflow so it is baked into the static bundle.
const API_BASE: string = (import.meta as any).env.VITE_API_URL ?? '';

const _originalFetch = window.fetch.bind(window);

window.fetch = async function patchedFetch(input, init) {
  // Redirect relative /api/* calls to the configured backend
  const url =
    typeof input === 'string' && input.startsWith('/api/')
      ? `${API_BASE}${input}`
      : input;

  const response = await _originalFetch(url, init);

  // Clone the response so the body can still be consumed by the caller, but
  // intercept situations where the server returns HTML instead of JSON (e.g.
  // a 404 page from GitHub Pages when VITE_API_URL is not set correctly).
  // We do NOT alter the response object – we just patch the .json() method so
  // the app gets a meaningful error message instead of a cryptic JSON parse
  // failure.
  const cloned = response.clone();
  const originalJson = response.json.bind(response);

  response.json = async () => {
    const text = await cloned.text();
    // If the response body looks like HTML, throw a developer-friendly error
    if (text.trimStart().startsWith('<')) {
      console.error(
        `[BehaviorPulse] API call to "${url}" returned HTML instead of JSON.\n` +
        `This usually means VITE_API_URL is not set (current value: "${API_BASE || '(empty)'}").\n` +
        `Response status: ${response.status}`
      );
      throw new Error(
        'Server is unreachable. Please check your internet connection or try again later.'
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from server: ${text.slice(0, 120)}`);
    }
  };

  return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
