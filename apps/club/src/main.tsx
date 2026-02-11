import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import App from './App';
import './styles.css';

// Amplify configuration will be loaded from amplify_outputs.json
try {
  const outputs = await import('../../amplify_outputs.json');
  Amplify.configure(outputs.default);
} catch (e) {
  console.warn('Amplify outputs not found, running without backend');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
