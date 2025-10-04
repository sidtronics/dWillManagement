import React from 'react';
import { Wallet } from 'lucide-react';

const WalletConnect = ({ onConnect }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
        <Wallet className="mx-auto mb-4 h-16 w-16 text-blue-500" />
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Will Management dApp</h1>
        <p className="text-gray-600 mb-6">Connect your MetaMask wallet to manage your digital will</p>
        <button
          onClick={onConnect}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium"
        >
          Connect Wallet
        </button>
      </div>
    </div>
  );
};

export default WalletConnect;
