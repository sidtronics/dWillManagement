import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, Clock, Shield, Eye } from 'lucide-react';
import apiService from '../services/api';

const BeneficiarySection = ({ account, contract, beneficiaryWills, showToast, loading, setLoading, refreshData }) => {
  const [willDetails, setWillDetails] = useState({});
  const [expandedWill, setExpandedWill] = useState(null);

  const executeWill = async (testator) => {
    if (!contract) return;
    try {
      setLoading(true);
      const tx = await contract.executeWill(testator);
      showToast('Executing will...', 'info');
      await tx.wait();
      showToast('Will executed successfully! Funds have been distributed.', 'success');
      setTimeout(() => refreshData(), 2000); // Wait for indexer to update
    } catch (error) {
      showToast(`Execution failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadWillDetails = async (willId) => {
    try {
      const response = await apiService.getWillDetails(willId);
      setWillDetails(prev => ({
        ...prev,
        [willId]: response.data
      }));
    } catch (error) {
      console.error('Failed to load will details:', error);
    }
  };

  const canExecuteWill = (will) => {
    if (will.executed) return false;
    
    const details = willDetails[will.willId];
    if (!details) return false;
    
    const now = Math.floor(Date.now() / 1000);
    const timeSinceLastCheckin = now - (details.lastCheckIn || 0);
    
    // Can execute if check-in period has passed
    return timeSinceLastCheckin > details.checkInPeriod;
  };

  const formatTimePeriod = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const getExecutionStatus = (will) => {
    if (will.executed) return { status: 'executed', message: 'Will has been executed', color: 'red' };
    
    const details = willDetails[will.willId];
    if (!details) return { status: 'loading', message: 'Loading...', color: 'gray' };
    
    const now = Math.floor(Date.now() / 1000);
    const timeSinceLastCheckin = now - (details.lastCheckIn || 0);
    const timeUntilExecution = details.checkInPeriod - timeSinceLastCheckin;
    
    if (timeUntilExecution <= 0) {
      return { status: 'executable', message: 'Ready to execute', color: 'orange' };
    } else {
      const timeLeft = formatTimePeriod(timeUntilExecution);
      return { status: 'waiting', message: `Executable in ${timeLeft}`, color: 'green' };
    }
  };

  useEffect(() => {
    // Load details for all wills
    beneficiaryWills.forEach(will => {
      if (!willDetails[will.willId]) {
        loadWillDetails(will.willId);
      }
    });
  }, [beneficiaryWills]);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold flex items-center">
          <Users className="mr-2 h-5 w-5" />
          As Beneficiary
        </h2>
        <p className="text-sm text-gray-600 mt-1">Wills where you are listed as a beneficiary</p>
      </div>
      
      <div className="p-6">
        {beneficiaryWills.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500">You are not listed as a beneficiary in any wills</p>
            <p className="text-sm text-gray-400 mt-1">When someone adds you as a beneficiary, their will will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {beneficiaryWills.map((will, index) => {
              const details = willDetails[will.willId];
              const executionStatus = getExecutionStatus(will);
              const isExpanded = expandedWill === will.willId;
              
              return (
                <div key={index} className="border rounded-lg overflow-hidden">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">
                            Testator: {will.testator.slice(0, 6)}...{will.testator.slice(-4)}
                          </p>
                          {details?.guardian === account && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full flex items-center">
                              <Shield className="h-3 w-3 mr-1" />
                              Guardian
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">Your share: <span className="font-semibold">{will.share}%</span></p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          executionStatus.color === 'red' ? 'bg-red-100 text-red-800' :
                          executionStatus.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                          executionStatus.color === 'green' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {executionStatus.message}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setExpandedWill(isExpanded ? null : will.willId)}
                        className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        {isExpanded ? 'Hide Details' : 'View Details'}
                      </button>
                      
                      {canExecuteWill(will) && (
                        <button
                          onClick={() => executeWill(will.testator)}
                          disabled={loading}
                          className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          Execute Will
                        </button>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && details && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Check-in Period:</p>
                            <p className="font-medium">{formatTimePeriod(details.checkInPeriod)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Last Check-in:</p>
                            <p className="font-medium">
                              {details.lastCheckIn ? 
                                new Date(details.lastCheckIn * 1000).toLocaleDateString() : 
                                'Never'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Dispute Period:</p>
                            <p className="font-medium">{formatTimePeriod(details.disputePeriod)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Total Beneficiaries:</p>
                            <p className="font-medium">{details.beneficiaries?.length || 0}</p>
                          </div>
                        </div>
                        
                        {/* Vault Information */}
                        {details.vaults && (
                          <div className="pt-2 border-t">
                            <p className="text-gray-600 text-sm mb-2">Vault Balances:</p>
                            <div className="grid grid-cols-2 gap-2">
                              {details.vaults.map((vault, idx) => (
                                <div key={idx} className="bg-white p-2 rounded border">
                                  <p className="text-xs text-gray-500 capitalize">{vault.vaultType}</p>
                                  <p className="font-medium text-sm">
                                    {parseFloat(vault.balance) / 1e18} ETH
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Expected Share */}
                        {details.vaults && (
                          <div className="pt-2 border-t">
                            <p className="text-gray-600 text-sm">Your expected inheritance:</p>
                            <p className="font-semibold text-green-600">
                              {(
                                (details.vaults.reduce((sum, vault) => sum + parseFloat(vault.balance), 0) / 1e18) * 
                                (will.share / 100)
                              ).toFixed(4)} ETH
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BeneficiarySection;
