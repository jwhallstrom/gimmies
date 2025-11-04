import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import App from './pages/App';
import './styles.css';

// Configure Amplify
Amplify.configure(outputs);

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
