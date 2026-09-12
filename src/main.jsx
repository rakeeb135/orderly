import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/* ------------------------------------------------------------------ */
/*  PWA Service Worker Registration                                    */
/*                                                                      */
/*  The previous code used `process.env.NODE_ENV` which does NOT exist */
/*  in Vite. That's why the SW never registered and Android refused    */
/*  to treat the site as installable.                                 */
/*                                                                      */
/*  We now use `import.meta.env.PROD` — the correct Vite equivalent.   */
/*  SW only registers in production builds (npm run build), because   */
/*  in dev mode Vite's HMR would fight with the SW cache.              */
/* ------------------------------------------------------------------ */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service worker registered. Scope:', registration.scope);

        // Check for updates every 60 seconds while app is open
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60000);
      })
      .catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err);
      });
  });
}