import React from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🏆</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Gimmies Tournaments</h1>
          <p className="text-blue-200">Create & manage golf tournaments</p>
        </div>
        
        <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
          <Authenticator
            socialProviders={['google']}
            signUpAttributes={['email', 'name']}
          >
            {() => {
              onSuccess();
              return null;
            }}
          </Authenticator>
        </div>
        
        <div className="text-center mt-6">
          <a 
            href="https://app.golfwithgimmies.com" 
            className="text-blue-300 hover:text-blue-200 text-sm"
          >
            ← Return to Gimmies App
          </a>
        </div>
      </div>
    </div>
  );
};
