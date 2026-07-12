import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installLocalApi } from './localApi.ts';

// Install the API interceptor BEFORE React mounts.
// • When VITE_API_URL is empty (GitHub Pages static deploy) → all /api/* calls
//   are handled in-browser using localStorage. No backend needed.
// • When VITE_API_URL points to a live server → calls go to the real backend,
//   with transparent localStorage fallback if the server is unreachable.
installLocalApi();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
