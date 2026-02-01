import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

// Configure Amplify
import { configureAmplify } from '@gimmies/shared/auth';
import amplifyOutputs from '../../../amplify_outputs.json';

configureAmplify(amplifyOutputs);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
