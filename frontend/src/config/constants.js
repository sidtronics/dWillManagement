export const CONTRACT_ADDRESS = '0x5fbdb2315678afecb367f032d93f642f64180aa3';
export const INDEXER_API = 'http://localhost:3001';

export const CONTRACT_ABI = [
  'function createWill(uint256 checkInPeriod, uint256 disputePeriod)',
  'function executeWill(address testator)',
  'function checkIn()',
  'function addBeneficiary(address beneficiary, uint256 share, bool isGuardian)',
  'function updateBeneficiary(address beneficiary, uint256 newShare, bool isGuardian)',
  'function removeBeneficiary(address beneficiary)',
  'function depositLocked() payable',
  'function depositFlexible() payable',
  'function withdrawFlexible(uint256 amount)'
];

export const DEFAULT_PERIODS = {
  checkInPeriod: 30 * 24 * 3600, // 30 days
  disputePeriod: 7 * 24 * 3600   // 7 days
};
