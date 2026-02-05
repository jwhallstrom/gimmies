import React from 'react';
import { WalletSummary } from '../components/wallet';

const WalletPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <WalletSummary />
    </div>
  );
};

export default WalletPage;
