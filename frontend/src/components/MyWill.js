import React, { useState, useEffect } from 'react';
import { Shield, Clock, Vault, Users, Plus, Trash2, ArrowDownToLine, Send, Edit, CheckCircle } from 'lucide-react';
import { ethers } from 'ethers';
import apiService from '../services/api';
import { DEFAULT_PERIODS } from '../config/constants';

const MyWill = ({ account, contract, myWills, showToast, loading, setLoading, refreshData }) => {
  const [selectedWill, setSelectedWill] = useState(null);
  const [willDetails, setWillDetails] = useState(null);
  const [vaultBalances, setVaultBalances] = useState({ locked: '0', flexible: '0' });
  const [createWillForm, setCreateWillForm] = useState(DEFAULT_PERIODS);
  const [beneficiaryForm, setBeneficiaryForm] = useState({ address: '', share: 0, isGuardian: false });
  const [editingBeneficiary, setEditingBeneficiary] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    console.log('MyWill - myWills updated:', myWills);
    if (myWills.length > 0 && !selectedWill) {
      console.log('Setting selected will to:', myWills[0]);
      setSelectedWill(myWills[0]);
    } else if (myWills.length === 0) {
      console.log('No wills found, clearing selected will');
      setSelectedWill(null);
      setWillDetails(null);
    }
  }, [myWills]);

  useEffect(() => {
    if (selectedWill) {
      loadWillDetails();
    }
  }, [selectedWill]);

  const loadWillDetails = async () => {
    if (!selectedWill) {
      console.log('No selected will, skipping details load');
      return;
    }
    
    try {
      console.log('Loading details for will:', selectedWill.willId);
      const response = await apiService.getWillDetails(selectedWill.willId);
      console.log('Will details response:', response);
      
      setWillDetails(response.data);
      
      const vaultResponse = await apiService.getVaultBalances(selectedWill.willId);
      console.log('Vault balances response:', vaultResponse);
      
      const balances = vaultResponse.data.vaults || { locked: '0', flexible: '0' };
      setVaultBalances(balances);
      
    } catch (error) {
      console.error('Failed to load will details:', error);
      showToast(`Failed to load will details: ${error.message}`, 'error');
    }
  };

  const createWill = async () => {
    if (!contract) {
      showToast('Contract not connected', 'error');
      return;
    }
    
    try {
      setLoading(true);
      
      // Validate inputs
      if (createWillForm.checkInPeriod <= 0 || createWillForm.disputePeriod <= 0) {
        showToast('Periods must be greater than 0', 'error');
        return;
      }
      
      console.log('Creating will with params:', createWillForm);
      showToast('Creating will...', 'info');
      
      const tx = await contract.createWill(createWillForm.checkInPeriod, createWillForm.disputePeriod);
      console.log('Transaction sent:', tx.hash);
      
      showToast('Transaction submitted. Waiting for confirmation...', 'info');
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);
      
      showToast('Will created successfully!', 'success');
      
      // Wait longer for indexer to catch up and then refresh
      setTimeout(async () => {
        console.log('Refreshing data after will creation...');
        await refreshData();
      }, 3000);
      
    } catch (error) {
      console.error('Create will error:', error);
      showToast(`Failed to create will: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkIn = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      const tx = await contract.checkIn();
      showToast('Processing check-in...', 'info');
      await tx.wait();
      showToast('Check-in completed successfully!', 'success');
      setTimeout(() => {
        loadWillDetails();
        refreshData();
      }, 2000); // Wait for indexer to update
    } catch (error) {
      showToast(`Check-in failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const addBeneficiary = async () => {
    if (!contract || !beneficiaryForm.address || !isValidAddress(beneficiaryForm.address)) return;
    
    // Validate total shares won't exceed 100%
    const currentTotal = getTotalShares();
    if (currentTotal + beneficiaryForm.share > 100) {
      showToast('Total shares would exceed 100%', 'error');
      return;
    }
    
    try {
      setLoading(true);
      const tx = await contract.addBeneficiary(
        beneficiaryForm.address,
        beneficiaryForm.share,
        beneficiaryForm.isGuardian
      );
      showToast('Adding beneficiary...', 'info');
      await tx.wait();
      showToast('Beneficiary added successfully!', 'success');
      setBeneficiaryForm({ address: '', share: 0, isGuardian: false });
      setTimeout(() => loadWillDetails(), 2000); // Wait for indexer to update
    } catch (error) {
      showToast(`Failed to add beneficiary: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const removeBeneficiary = async (address) => {
    if (!contract) return;
    try {
      setLoading(true);
      const tx = await contract.removeBeneficiary(address);
      showToast('Removing beneficiary...', 'info');
      await tx.wait();
      showToast('Beneficiary removed successfully!', 'success');
      setTimeout(() => loadWillDetails(), 2000); // Wait for indexer to update
    } catch (error) {
      showToast(`Failed to remove beneficiary: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateBeneficiary = async (address, newShare, isGuardian) => {
    if (!contract) return;
    try {
      setLoading(true);
      const tx = await contract.updateBeneficiary(address, newShare, isGuardian);
      showToast('Updating beneficiary...', 'info');
      await tx.wait();
      showToast('Beneficiary updated successfully!', 'success');
      setTimeout(() => loadWillDetails(), 2000); // Wait for indexer to update
    } catch (error) {
      showToast(`Failed to update beneficiary: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const depositLocked = async () => {
    if (!contract || !depositAmount) return;
    
    const amount = parseFloat(depositAmount);
    if (amount <= 0) {
      showToast('Amount must be greater than 0', 'error');
      return;
    }
    
    try {
      setLoading(true);
      const tx = await contract.depositLocked({ value: ethers.parseEther(depositAmount) });
      showToast('Depositing to locked vault...', 'info');
      await tx.wait();
      showToast(`Successfully deposited ${depositAmount} ETH to locked vault!`, 'success');
      setDepositAmount('');
      setTimeout(() => loadWillDetails(), 2000); // Wait for indexer to update
    } catch (error) {
      showToast(`Deposit failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const depositFlexible = async () => {
    if (!contract || !depositAmount) return;
    
    const amount = parseFloat(depositAmount);
    if (amount <= 0) {
      showToast('Amount must be greater than 0', 'error');
      return;
    }
    
    try {
      setLoading(true);
      const tx = await contract.depositFlexible({ value: ethers.parseEther(depositAmount) });
      showToast('Depositing to flexible vault...', 'info');
      await tx.wait();
      showToast(`Successfully deposited ${depositAmount} ETH to flexible vault!`, 'success');
      setDepositAmount('');
      setTimeout(() => loadWillDetails(), 2000); // Wait for indexer to update
    } catch (error) {
      showToast(`Deposit failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const withdrawFlexible = async () => {
    if (!contract || !withdrawAmount) return;
    
    const amount = parseFloat(withdrawAmount);
    const availableBalance = parseFloat(formatEther(vaultBalances.flexible));
    
    if (amount <= 0) {
      showToast('Amount must be greater than 0', 'error');
      return;
    }
    
    if (amount > availableBalance) {
      showToast('Amount exceeds available balance', 'error');
      return;
    }
    
    try {
      setLoading(true);
      const tx = await contract.withdrawFlexible(ethers.parseEther(withdrawAmount));
      showToast('Withdrawing from flexible vault...', 'info');
      await tx.wait();
      showToast(`Successfully withdrew ${withdrawAmount} ETH from flexible vault!`, 'success');
      setWithdrawAmount('');
      setTimeout(() => loadWillDetails(), 2000); // Wait for indexer to update
    } catch (error) {
      showToast(`Withdrawal failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatEther = (wei) => ethers.formatEther(wei || '0');
  const isValidAddress = (address) => /^0x[a-fA-F0-9]{40}$/.test(address);
  const getTotalShares = () => willDetails?.beneficiaries?.reduce((sum, b) => sum + b.share, 0) || 0;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          My Will
        </h2>
      </div>
      
      <div className="p-6 space-y-6">

        {myWills.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No will created yet</p>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check-in Period (seconds)
                  </label>
                  <input
                    type="number"
                    min="3600"
                    placeholder="e.g., 2592000 (30 days)"
                    value={createWillForm.checkInPeriod}
                    onChange={(e) => setCreateWillForm({...createWillForm, checkInPeriod: parseInt(e.target.value) || 0})}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {Math.floor(createWillForm.checkInPeriod / 86400)} days
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dispute Period (seconds)
                  </label>
                  <input
                    type="number"
                    min="3600"
                    placeholder="e.g., 604800 (7 days)"
                    value={createWillForm.disputePeriod}
                    onChange={(e) => setCreateWillForm({...createWillForm, disputePeriod: parseInt(e.target.value) || 0})}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {Math.floor(createWillForm.disputePeriod / 86400)} days
                  </p>
                </div>
              </div>
              <button
                onClick={createWill}
                disabled={loading || createWillForm.checkInPeriod <= 0 || createWillForm.disputePeriod <= 0}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 w-full font-medium"
              >
                {loading ? 'Creating...' : 'Create Will'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Will Status */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`px-2 py-1 rounded text-xs ${selectedWill?.executed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {selectedWill?.executed ? 'Executed' : 'Active'}
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Check-in Period: {Math.floor(selectedWill?.checkInPeriod / 3600)} hours</p>
                <p>Last Check-in: {selectedWill?.lastCheckIn ? new Date(selectedWill.lastCheckIn * 1000).toLocaleString() : 'Never'}</p>
              </div>
              {!selectedWill?.executed && (
                <button
                  onClick={checkIn}
                  disabled={loading}
                  className="mt-3 bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 disabled:opacity-50"
                >
                  <Clock className="inline h-4 w-4 mr-1" />
                  Check In
                </button>
              )}
            </div>

            {/* Vault Balances */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center">
                <Vault className="mr-2 h-4 w-4" />
                Vault Management
              </h3>
              
              {/* Balance Display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-blue-700">Locked Vault</p>
                    <Shield className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-lg font-bold text-blue-900">{formatEther(vaultBalances.locked)} ETH</p>
                  <p className="text-xs text-blue-600 mt-1">Cannot be withdrawn by testator</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-green-700">Flexible Vault</p>
                    <Vault className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-lg font-bold text-green-900">{formatEther(vaultBalances.flexible)} ETH</p>
                  <p className="text-xs text-green-600 mt-1">Can be withdrawn anytime</p>
                </div>
              </div>
              
              {!selectedWill?.executed && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  {/* Deposit Section */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Deposit Funds</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Amount in ETH"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                        onClick={depositLocked}
                        disabled={loading || !depositAmount || parseFloat(depositAmount) <= 0}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                        title="Deposit to locked vault"
                      >
                        <ArrowDownToLine className="h-4 w-4" />
                        Lock
                      </button>
                      <button
                        onClick={depositFlexible}
                        disabled={loading || !depositAmount || parseFloat(depositAmount) <= 0}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
                        title="Deposit to flexible vault"
                      >
                        <ArrowDownToLine className="h-4 w-4" />
                        Flexible
                      </button>
                    </div>
                  </div>
                  
                  {/* Withdraw Section */}
                  <div className="space-y-2 pt-2 border-t">
                    <label className="text-sm font-medium text-gray-700">Withdraw from Flexible Vault</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={formatEther(vaultBalances.flexible)}
                        placeholder="Amount to withdraw"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => setWithdrawAmount(formatEther(vaultBalances.flexible))}
                        disabled={loading || vaultBalances.flexible === '0'}
                        className="bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 text-sm"
                      >
                        Max
                      </button>
                      <button
                        onClick={withdrawFlexible}
                        disabled={loading || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > parseFloat(formatEther(vaultBalances.flexible))}
                        className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-1"
                        title="Withdraw from flexible vault"
                      >
                        <Send className="h-4 w-4" />
                        Withdraw
                      </button>
                    </div>
                    {withdrawAmount && parseFloat(withdrawAmount) > parseFloat(formatEther(vaultBalances.flexible)) && (
                      <p className="text-red-500 text-xs">Amount exceeds available balance</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Total Value Display */}
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-700">
                  Total Will Value: <span className="font-bold">
                    {(parseFloat(formatEther(vaultBalances.locked)) + parseFloat(formatEther(vaultBalances.flexible))).toFixed(4)} ETH
                  </span>
                </p>
              </div>
            </div>>


            {/* Beneficiaries */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center">
                <Users className="mr-2 h-4 w-4" />
                Beneficiaries ({getTotalShares()}% allocated)
              </h3>
              
              {willDetails?.beneficiaries?.map((beneficiary, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  {editingBeneficiary === beneficiary.beneficiary ? (
                    // Edit mode
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{beneficiary.beneficiary.slice(0, 6)}...{beneficiary.beneficiary.slice(-4)}</p>
                        <button
                          onClick={() => setEditingBeneficiary(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          placeholder="New share %"
                          defaultValue={beneficiary.share}
                          ref={(input) => {
                            if (input) input.newShare = beneficiary.share;
                          }}
                          onChange={(e) => {
                            e.target.newShare = parseInt(e.target.value) || 0;
                          }}
                          className="flex-1 border rounded px-2 py-1 text-sm"
                        />
                        <label className="flex items-center text-sm">
                          <input
                            type="checkbox"
                            defaultChecked={willDetails.guardian === beneficiary.beneficiary}
                            ref={(input) => {
                              if (input) input.isGuardian = willDetails.guardian === beneficiary.beneficiary;
                            }}
                            onChange={(e) => {
                              e.target.isGuardian = e.target.checked;
                            }}
                            className="mr-1"
                          />
                          Guardian
                        </label>
                        <button
                          onClick={(e) => {
                            const shareInput = e.target.parentElement.querySelector('input[type="number"]');
                            const guardianInput = e.target.parentElement.querySelector('input[type="checkbox"]');
                            updateBeneficiary(
                              beneficiary.beneficiary, 
                              shareInput.newShare, 
                              guardianInput.isGuardian
                            );
                            setEditingBeneficiary(null);
                          }}
                          disabled={loading}
                          className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                        >
                          <CheckCircle className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{beneficiary.beneficiary.slice(0, 6)}...{beneficiary.beneficiary.slice(-4)}</p>
                        <p className="text-sm text-gray-600">
                          {beneficiary.share}% 
                          {willDetails.guardian === beneficiary.beneficiary && (
                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Guardian</span>
                          )}
                        </p>
                      </div>
                      {!selectedWill?.executed && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingBeneficiary(beneficiary.beneficiary)}
                            disabled={loading}
                            className="text-blue-500 hover:text-blue-700 disabled:opacity-50"
                            title="Edit beneficiary"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeBeneficiary(beneficiary.beneficiary)}
                            disabled={loading}
                            className="text-red-500 hover:text-red-700 disabled:opacity-50"
                            title="Remove beneficiary"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Add new beneficiary form */}
              {!selectedWill?.executed && getTotalShares() < 100 && (
                <div className="space-y-2 p-3 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Add New Beneficiary</p>
                  <input
                    type="text"
                    placeholder="Beneficiary address (0x...)"
                    value={beneficiaryForm.address}
                    onChange={(e) => setBeneficiaryForm({...beneficiaryForm, address: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="Share %"
                      min="1"
                      max={100 - getTotalShares()}
                      value={beneficiaryForm.share || ''}
                      onChange={(e) => setBeneficiaryForm({...beneficiaryForm, share: parseInt(e.target.value) || 0})}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <label className="flex items-center text-sm whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={beneficiaryForm.isGuardian}
                        onChange={(e) => setBeneficiaryForm({...beneficiaryForm, isGuardian: e.target.checked})}
                        className="mr-1"
                      />
                      Guardian
                    </label>
                    <button
                      onClick={addBeneficiary}
                      disabled={loading || !isValidAddress(beneficiaryForm.address) || beneficiaryForm.share === 0 || getTotalShares() + beneficiaryForm.share > 100}
                      className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center"
                      title="Add beneficiary"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </button>
                  </div>
                  {getTotalShares() + beneficiaryForm.share > 100 && (
                    <p className="text-red-500 text-xs">Total shares would exceed 100%</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MyWill;
