import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Must run before any other Amplify usage
import './amplify/configure';

import App from './pages/App';
import './styles.css';

// In dev, ensure SW doesn't cache stale bundles.
if (import.meta.env.DEV && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

// Only register the PWA service worker in production builds.
if (import.meta.env.PROD && typeof window !== 'undefined') {
  import('virtual:pwa-register').then(({ registerSW }) => {
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
      onRegisteredSW(_swUrl, registration) {
        // Check for updates every 5 minutes
        if (registration) {
          setInterval(() => {
            registration.update();
          }, 5 * 60 * 1000);
        }
      },
    });
  });
}

if (typeof window !== 'undefined') {
  // ---- Standalone PWA detection ----
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

  // ---- Android viewport height fix ----
  // On Android Chrome, 100vh includes the URL bar which causes content to overflow.
  // This sets a CSS variable --app-height to the real visible viewport height.
  // Uses visualViewport API (supported on Android Chrome 61+, iOS Safari 13+).
  const setAppHeight = () => {
    const vh = window.visualViewport
      ? window.visualViewport.height
      : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${vh}px`);
  };

  setAppHeight();
  window.addEventListener('resize', setAppHeight);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setAppHeight);
  }

  // ---- Android platform detection (for platform-specific CSS) ----
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) {
    document.body.classList.add('platform-android');
  } else if (/iphone|ipad|ipod/i.test(ua) || ((navigator as any).standalone !== undefined)) {
    document.body.classList.add('platform-ios');
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
