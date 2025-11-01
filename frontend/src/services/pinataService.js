/**
 * Pinata IPFS Service
 * Handles file uploads to Pinata IPFS
 */

const PINATA_API_KEY = process.env.REACT_APP_PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.REACT_APP_PINATA_SECRET_KEY;
const PINATA_GATEWAY = 'https://gateway.pinata.cloud';

class PinataService {
  /**
   * Upload a file to Pinata IPFS
   * @param {File} file - The file to upload
   * @param {Object} metadata - Optional metadata for the file
   * @returns {Promise<Object>} - Returns the IPFS hash and other details
   */
  async uploadFile(file, metadata = {}) {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      throw new Error('Pinata API credentials not configured');
    }

    const formData = new FormData();
    formData.append('file', file);

    // Add metadata if provided
    const pinataMetadata = {
      name: metadata.fileName || file.name,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        documentType: metadata.documentType || 'other',
        ...metadata.keyvalues
      }
    };

    formData.append('pinataMetadata', JSON.stringify(pinataMetadata));

    // Optional pinata options
    const pinataOptions = {
      cidVersion: 1,
    };
    formData.append('pinataOptions', JSON.stringify(pinataOptions));

    try {
      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file to Pinata');
      }

      const data = await response.json();
      
      return {
        ipfsHash: data.IpfsHash,
        pinSize: data.PinSize,
        timestamp: data.Timestamp,
        gatewayUrl: `${PINATA_GATEWAY}/ipfs/${data.IpfsHash}`
      };
    } catch (error) {
      console.error('Pinata upload error:', error);
      throw error;
    }
  }

  /**
   * Get the gateway URL for an IPFS hash
   * @param {string} ipfsHash - The IPFS hash
   * @returns {string} - The gateway URL
   */
  getGatewayUrl(ipfsHash) {
    return `${PINATA_GATEWAY}/ipfs/${ipfsHash}`;
  }

  /**
   * Unpin a file from Pinata (optional - requires API access)
   * @param {string} ipfsHash - The IPFS hash to unpin
   * @returns {Promise<void>}
   */
  async unpinFile(ipfsHash) {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      throw new Error('Pinata API credentials not configured');
    }

    try {
      const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${ipfsHash}`, {
        method: 'DELETE',
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unpin file from Pinata');
      }

      return true;
    } catch (error) {
      console.error('Pinata unpin error:', error);
      throw error;
    }
  }

  /**
   * Test the Pinata connection
   * @returns {Promise<boolean>} - Returns true if connection is successful
   */
  async testAuthentication() {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      return false;
    }

    try {
      const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
        method: 'GET',
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Pinata authentication test failed:', error);
      return false;
    }
  }
}

export default new PinataService();
