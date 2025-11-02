import React from 'react';
import { LoginPage } from '../components/auth/LoginPage';

/**
 * Demo page to preview the new AWS Amplify login UI
 * Access at: http://localhost:5173/auth-demo
 */
export function AuthDemoPage() {
  return (
    <div>
      <LoginPage onSuccess={() => {
        alert('✅ Login successful! (Demo mode - not actually connected to AWS yet)');
        console.log('Login success callback fired');
      }} />
      
      {/* Developer Notes */}
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl p-4 max-w-sm border-2 border-blue-500">
        <h3 className="font-bold text-sm text-blue-600 mb-2">🎨 Auth Demo Mode</h3>
        <p className="text-xs text-gray-600 mb-2">
          This is a preview of the login UI. To connect to AWS:
        </p>
        <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
          <li>Run: <code className="bg-gray-100 px-1 rounded">npm run amplify:sandbox</code></li>
          <li>Configure Google OAuth in .env.local</li>
          <li>Restart dev server</li>
        </ol>
        <p className="text-xs text-gray-500 mt-2">
          Currently showing UI only - AWS not connected
        </p>
      </div>
    </div>
  );
}
