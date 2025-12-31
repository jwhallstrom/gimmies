import React from 'react';
import { Link } from 'react-router-dom';
import { WalletSummary } from '../components/wallet';

const WalletPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-800 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <WalletSummary />
    </div>
  );
};

export default WalletPage;
