import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, Clock, Shield, Eye, ChevronDown, ChevronUp } from 'lucide-react';
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
      setTimeout(() => refreshData(), 2000);
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
    beneficiaryWills.forEach(will => {
      if (!willDetails[will.willId]) {
        loadWillDetails(will.willId);
      }
    });
  }, [beneficiaryWills]);

  return (
    <div className="space-y-6">
      {beneficiaryWills.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <Users className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Beneficiary Assignments</h3>
            <p className="text-gray-500 mb-2">You are not listed as a beneficiary in any wills</p>
            <p className="text-sm text-gray-400">When someone adds you as a beneficiary, their will will appear here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {beneficiaryWills.map((will, index) => {
            const details = willDetails[will.willId];
            const executionStatus = getExecutionStatus(will);
            const isExpanded = expandedWill === will.willId;
            
            return (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  {/* Header Section */}
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Testator: {will.testator}
                        </h4>
                        {details?.guardian === account && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full flex items-center font-medium">
                            <Shield className="h-3 w-3 mr-1" />
                            Guardian
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Your share: <span className="font-semibold text-gray-900">{will.share}%</span></span>
                        <span className="text-gray-400">•</span>
                        <span>Will ID: {will.willId}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-2 rounded-lg text-sm font-medium ${
                        executionStatus.color === 'red' ? 'bg-red-100 text-red-800' :
                        executionStatus.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                        executionStatus.color === 'green' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {executionStatus.message}
                      </span>
                      
                      {canExecuteWill(will) && (
                        <button
                          onClick={() => executeWill(will.testator)}
                          disabled={loading}
                          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 font-medium transition-colors"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          Execute Will
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Toggle Details Button */}
                  <button
                    onClick={() => setExpandedWill(isExpanded ? null : will.willId)}
                    className="w-full mt-4 flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium py-2 border-t border-gray-200 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        View Details
                      </>
                    )}
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && details && (
                  <div className="px-6 pb-6 border-t border-gray-200 bg-gray-50">
                    <div className="pt-6 space-y-6">
                      {/* Will Configuration */}
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900 mb-3">Will Configuration</h5>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-600 mb-1">Check-in Period</p>
                            <p className="font-semibold text-gray-900">{formatTimePeriod(details.checkInPeriod)}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-600 mb-1">Last Check-in</p>
                            <p className="font-semibold text-gray-900">
                              {details.lastCheckIn ? 
                                new Date(details.lastCheckIn * 1000).toLocaleDateString() : 
                                'Never'
                              }
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-600 mb-1">Dispute Period</p>
                            <p className="font-semibold text-gray-900">{formatTimePeriod(details.disputePeriod)}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-600 mb-1">Total Beneficiaries</p>
                            <p className="font-semibold text-gray-900">{details.beneficiaries?.length || 0}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Vault Information */}
                      {details.vaults && details.vaults.length > 0 && (
                        <div>
                          <h5 className="text-sm font-semibold text-gray-900 mb-3">Vault Balances</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {details.vaults.map((vault, idx) => (
                              <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs text-gray-600 capitalize font-medium">{vault.vaultType} Vault</p>
                                  {vault.vaultType === 'locked' ? (
                                    <Shield className="h-4 w-4 text-blue-600" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-green-600" />
                                  )}
                                </div>
                                <p className="text-xl font-bold text-gray-900">
                                  {(parseFloat(vault.balance) / 1e18).toFixed(4)} ETH
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Expected Inheritance */}
                      {details.vaults && details.vaults.length > 0 && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-green-700 font-medium mb-1">Your Expected Inheritance</p>
                              <p className="text-xs text-green-600">Based on current vault balances and your {will.share}% share</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-green-700">
                                {(
                                  (details.vaults.reduce((sum, vault) => sum + parseFloat(vault.balance), 0) / 1e18) * 
                                  (will.share / 100)
                                ).toFixed(4)} ETH
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* All Beneficiaries */}
                      {details.beneficiaries && details.beneficiaries.length > 0 && (
                        <div>
                          <h5 className="text-sm font-semibold text-gray-900 mb-3">All Beneficiaries</h5>
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Share</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {details.beneficiaries.map((beneficiary, idx) => (
                                  <tr key={idx} className={beneficiary.beneficiary === account ? 'bg-blue-50' : ''}>
                                    <td className="px-4 py-3 text-sm">
                                      <span className={beneficiary.beneficiary === account ? 'font-semibold text-blue-900' : 'text-gray-900'}>
                                        {beneficiary.beneficiary}
                                      </span>
                                      {beneficiary.beneficiary === account && (
                                        <span className="ml-2 text-xs text-blue-600">(You)</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{beneficiary.share}%</td>
                                    <td className="px-4 py-3 text-sm">
                                      {details.guardian === beneficiary.beneficiary && (
                                        <span className="inline-flex items-center text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                          <Shield className="h-3 w-3 mr-1" />
                                          Guardian
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BeneficiarySection;
