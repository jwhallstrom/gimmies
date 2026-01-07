import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

// Ensure Amplify is configured before any other Amplify modules
// (e.g., aws-amplify/data generateClient at module scope) are evaluated.
Amplify.configure(outputs);
