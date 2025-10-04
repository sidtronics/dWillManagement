import { INDEXER_API } from '../config/constants';

class ApiService {
  async request(endpoint) {
    try {
      console.log(`Making API request to: ${INDEXER_API}${endpoint}`);
      const response = await fetch(`${INDEXER_API}${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`API response for ${endpoint}:`, data);
      
      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }
      
      return data;
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      
      // More specific error messages
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Cannot connect to indexer API. Make sure it\'s running on http://localhost:3001');
      }
      
      throw error;
    }
  }

  // Health check
  async getHealth() {
    return this.request('/health');
  }

  // Get wills by testator  
  async getWillsByTestator(testator) {
    if (!testator) throw new Error('Testator address is required');
    return this.request(`/wills/${testator.toLowerCase()}`);
  }

  // Get wills where user is beneficiary
  async getWillsByBeneficiary(beneficiary) {
    if (!beneficiary) throw new Error('Beneficiary address is required');
    return this.request(`/wills/beneficiary/${beneficiary.toLowerCase()}`);
  }

  // Get full will details
  async getWillDetails(willId) {
    if (!willId) throw new Error('Will ID is required');
    return this.request(`/will/${willId.toLowerCase()}`);
  }

  // Get beneficiary wills and shares
  async getBeneficiaryWills(beneficiary) {
    if (!beneficiary) throw new Error('Beneficiary address is required');
    return this.request(`/beneficiaries/${beneficiary.toLowerCase()}`);
  }

  // Get vault balances
  async getVaultBalances(willId) {
    if (!willId) throw new Error('Will ID is required');
    return this.request(`/vaults/${willId.toLowerCase()}`);
  }

  // Get statistics
  async getStats() {
    return this.request('/stats');
  }
}

export default new ApiService();
