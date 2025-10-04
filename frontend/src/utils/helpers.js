import { ethers } from 'ethers';

export const formatEther = (wei) => {
  try {
    return ethers.formatEther(wei || '0');
  } catch (error) {
    return '0';
  }
};

export const parseEther = (ether) => {
  try {
    return ethers.parseEther(ether || '0');
  } catch (error) {
    return ethers.parseEther('0');
  }
};

export const isValidAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Never';
  return new Date(timestamp * 1000).toLocaleString();
};

export const formatPeriod = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours > 1 ? 's' : ''}`;
};

export const canExecuteWill = (will, willDetails) => {
  if (!will || !willDetails) return false;
  if (will.executed) return false;
  
  const now = Math.floor(Date.now() / 1000);
  const timeSinceLastCheckin = now - (willDetails.lastCheckIn || 0);
  
  return timeSinceLastCheckin > willDetails.checkInPeriod;
};

export const validateBeneficiaryForm = (form, existingBeneficiaries = []) => {
  const errors = [];
  
  if (!form.address) {
    errors.push('Address is required');
  } else if (!isValidAddress(form.address)) {
    errors.push('Invalid address format');
  }
  
  if (!form.share || form.share <= 0) {
    errors.push('Share must be greater than 0');
  } else if (form.share > 100) {
    errors.push('Share cannot exceed 100%');
  }
  
  const totalExistingShares = existingBeneficiaries.reduce((sum, b) => sum + b.share, 0);
  if (totalExistingShares + form.share > 100) {
    errors.push('Total shares would exceed 100%');
  }
  
  const addressExists = existingBeneficiaries.some(b => 
    b.beneficiary.toLowerCase() === form.address.toLowerCase()
  );
  if (addressExists) {
    errors.push('Beneficiary already exists');
  }
  
  return errors;
};

export const validateDepositAmount = (amount) => {
  if (!amount) return 'Amount is required';
  
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return 'Amount must be greater than 0';
  }
  
  if (numAmount > 1000) {
    return 'Amount seems unusually large';
  }
  
  return null;
};

export const validateWithdrawAmount = (amount, availableBalance) => {
  const depositError = validateDepositAmount(amount);
  if (depositError) return depositError;
  
  const numAmount = parseFloat(amount);
  const numBalance = parseFloat(formatEther(availableBalance));
  
  if (numAmount > numBalance) {
    return 'Amount exceeds available balance';
  }
  
  return null;
};
