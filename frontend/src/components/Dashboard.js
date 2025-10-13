import React, { useState, useEffect } from 'react';
import MyWill from './MyWill';
import BeneficiarySection from './BeneficiarySection';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import apiService from '../services/api';

const Dashboard = ({ account, contract, showToast, onDisconnect }) => {
  const [myWills, setMyWills] = useState([]);
  const [beneficiaryWills, setBeneficiaryWills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState('my-will');

  const loadMyWills = async () => {
    if (!account) return;
    
    try {
      console.log('Loading wills for account:', account);
      const response = await apiService.getWillsByTestator(account);
      console.log('API response for my wills:', response);
      
      const wills = response.data || [];
      console.log('Parsed wills:', wills);
      
      setMyWills(wills);
      
      if (wills.length > 0) {
        console.log('Found wills:', wills.length);
      } else {
        console.log('No wills found for account:', account);
      }
    } catch (error) {
      console.error('Failed to load wills:', error);
      showToast(`Failed to load wills: ${error.message}`, 'error');
      // Set empty array on error so UI doesn't break
      setMyWills([]);
    }
  };

  const loadBeneficiaryWills = async () => {
    if (!account) return;
    
    try {
      console.log('Loading beneficiary wills for account:', account);
      const response = await apiService.getBeneficiaryWills(account);
      console.log('API response for beneficiary wills:', response);
      
      const wills = response.data || [];
      setBeneficiaryWills(wills);
    } catch (error) {
      console.error('Failed to load beneficiary wills:', error);
      showToast(`Failed to load beneficiary wills: ${error.message}`, 'error');
      // Set empty array on error so UI doesn't break
      setBeneficiaryWills([]);
    }
  };

  const refreshData = () => {
    loadMyWills();
    loadBeneficiaryWills();
  };

  useEffect(() => {
    if (account) {
      refreshData();
    }
  }, [account]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const renderContent = () => {
    switch (currentView) {
      
      case 'my-will':
        return (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Will</h2>
              <p className="text-gray-600 mt-1">Manage your will, beneficiaries, and vault balances</p>
            </div>
            <div className="max-w-8xl">
              <MyWill 
                account={account}
                contract={contract}
                myWills={myWills}
                showToast={showToast}
                loading={loading}
                setLoading={setLoading}
                refreshData={refreshData}
              />
            </div>
          </>
        );
      
      case 'beneficiary':
        return (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">As Beneficiary</h2>
              <p className="text-gray-600 mt-1">Wills where you are listed as a beneficiary</p>
            </div>
            <div className="max-w-8xl">
              <BeneficiarySection
                account={account}
                contract={contract}
                beneficiaryWills={beneficiaryWills}
                showToast={showToast}
                loading={loading}
                setLoading={setLoading}
                refreshData={refreshData}
              />
            </div>
          </>
        );
      
      case 'settings':
        return (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
              <p className="text-gray-600 mt-1">Manage your preferences and account settings</p>
            </div>
            <div className="max-w-8xl">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Account Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-gray-900">Connected Wallet</p>
                      <p className="text-sm text-gray-500">{account}</p>
                    </div>
                    <button
                      onClick={onDisconnect}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                    >
                      Disconnect
                    </button>
                  </div>
                  
                  <div className="py-3 border-b">
                    <p className="font-medium text-gray-900 mb-2">Notifications</p>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm text-gray-700">Email notifications for check-ins</span>
                    </label>
                    <label className="flex items-center space-x-3 mt-2">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm text-gray-700">Alert when eligible to execute will</span>
                    </label>
                  </div>
                  
                  <div className="py-3">
                    <p className="font-medium text-gray-900 mb-2">Network</p>
                    <p className="text-sm text-gray-600">Currently connected to Ethereum Mainnet</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      
      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Select a view from the sidebar</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        account={account}
        onDisconnect={onDisconnect}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />
      
      <Sidebar
        isOpen={isSidebarOpen}
        currentView={currentView}
        setCurrentView={setCurrentView}
      />

      <main 
        className={`pt-16 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'lg:ml-64' : 'ml-0 w-1'
        }`}
      >
        <div className="p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
