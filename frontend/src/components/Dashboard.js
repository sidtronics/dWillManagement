import React, { useState, useEffect } from 'react';
import MyWill from './MyWill';
import BeneficiarySection from './BeneficiarySection';
import apiService from '../services/api';

const Dashboard = ({ account, contract, showToast }) => {
  const [myWills, setMyWills] = useState([]);
  const [beneficiaryWills, setBeneficiaryWills] = useState([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">Will Management</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              <div className="h-2 w-2 bg-green-400 rounded-full"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MyWill 
            account={account}
            contract={contract}
            myWills={myWills}
            showToast={showToast}
            loading={loading}
            setLoading={setLoading}
            refreshData={refreshData}
          />
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
      </div>
    </>
  );
};

export default Dashboard;
