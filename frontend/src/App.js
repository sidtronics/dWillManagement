import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import WalletConnect from './components/WalletConnect';
import Dashboard from './components/Dashboard';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from './config/constants';
import apiService from './services/api';

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');
  const [toast, setToast] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [apiHealthy, setApiHealthy] = useState(false);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const checkApiHealth = async () => {
    try {
      await apiService.getHealth();
      setApiHealthy(true);
    } catch (error) {
      setApiHealthy(false);
      showToast('Indexer API is not available. Some features may not work.', 'warning');
    }
  };

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      
      if (!window.ethereum) {
        showToast('MetaMask not found! Please install MetaMask.', 'error');
        return;
      }

      // Request account access
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        showToast('No accounts found. Please unlock MetaMask.', 'error');
        return;
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Verify network (optional - add network validation here)
      const network = await provider.getNetwork();
      console.log('Connected to network:', network.name, 'Chain ID:', network.chainId.toString());

      setProvider(provider);
      setSigner(signer);
      setContract(contract);
      setAccount(accounts[0]);
      showToast('Wallet connected successfully!', 'success');

    } catch (error) {
      console.error('Connection error:', error);
      showToast(`Connection failed: ${error.message}`, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setContract(null);
    setAccount('');
    showToast('Wallet disconnected', 'info');
  };

  useEffect(() => {
    // Check API health on startup
    checkApiHealth();

    // Check if wallet is already connected
    if (window.ethereum && window.ethereum.selectedAddress) {
      connectWallet();
    }

    // Listen for account changes
    if (window.ethereum) {

      window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          const newProvider = new ethers.BrowserProvider(window.ethereum);
          const newSigner = await newProvider.getSigner();
          const newContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, newSigner);

          setProvider(newProvider);
          setSigner(newSigner);
          setContract(newContract);
          setAccount(accounts[0]);
          showToast('Account changed', 'info');
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    // Cleanup
    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner message="Connecting to wallet..." />
      </div>
    );
  }

  if (!account) {
    return (
      <>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <WalletConnect onConnect={connectWallet} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <Dashboard 
        account={account}
        contract={contract}
        provider={provider}
        showToast={showToast}
        apiHealthy={apiHealthy}
        onDisconnect={disconnectWallet}
      />
    </div>
  );
}
