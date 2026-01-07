import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';

// Must run before any other Amplify usage
import './amplify/configure';

import App from './pages/App';
import './styles.css';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const event = new CustomEvent('pwa:need-refresh', {
      detail: {
        update: () => updateSW(true),
      },
    });
    window.dispatchEvent(event);
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('pwa:offline-ready'));
  },
  onRegisteredSW(swUrl, registration) {
    // Check for updates every 5 minutes
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 5 * 60 * 1000);
    }
  },
});

if (typeof window !== 'undefined') {
  const mediaQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)')
      : null;

  const updateStandaloneClass = () => {
    const isStandalone =
      Boolean(mediaQuery?.matches) || (window.navigator as any).standalone === true;

    document.body.classList.toggle('pwa-standalone', isStandalone);
  };

  updateStandaloneClass();

  if (mediaQuery) {
    const listener = () => updateStandaloneClass();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(listener);
    }
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
