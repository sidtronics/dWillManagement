const express = require('express');
const cors = require('cors');
const {
    getWillsByTestator,
    getWillsByBeneficiary,
    getWillDetails,
    getBeneficiaryWills,
    getVaults,
    getDocuments,
    getDocumentByHash
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// Error handling middleware
function handleError(res, error, message = 'Internal server error') {
    console.error('API Error:', error);
    res.status(500).json({
        success: false,
        error: message,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
}

// Validation helpers
function isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidIpfsHash(hash) {
    // Basic IPFS hash validation (CIDv0 and CIDv1)
    return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafyb[a-z2-7]{50,})$/.test(hash);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Will Management API is running',
        timestamp: new Date().toISOString()
    });
});

// GET /wills/:testator - Get all wills where this address is the testator
app.get('/wills/:testator', (req, res) => {
    try {
        const { testator } = req.params;
        
        if (!isValidAddress(testator)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid testator address format'
            });
        }
        
        const wills = getWillsByTestator(testator);
        
        res.json({
            success: true,
            data: wills,
            count: wills.length
        });
        
    } catch (error) {
        handleError(res, error, 'Failed to fetch wills by testator');
    }
});

// GET /wills/beneficiary/:beneficiary - Get all wills where this address is a beneficiary
app.get('/wills/beneficiary/:beneficiary', (req, res) => {
    try {
        const { beneficiary } = req.params;
        
        if (!isValidAddress(beneficiary)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid beneficiary address format'
            });
        }
        
        const wills = getWillsByBeneficiary(beneficiary);
        
        res.json({
            success: true,
            data: wills,
            count: wills.length
        });
        
    } catch (error) {
        handleError(res, error, 'Failed to fetch wills by beneficiary');
    }
});

// GET /will/:id - Get full details of a specific will
app.get('/will/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        if (!isValidAddress(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid will ID format (should be testator address)'
            });
        }
        
        const willDetails = getWillDetails(id);
        
        if (!willDetails) {
            return res.status(404).json({
                success: false,
                error: 'Will not found'
            });
        }
        
        res.json({
            success: true,
            data: willDetails
        });
        
    } catch (error) {
        handleError(res, error, 'Failed to fetch will details');
    }
});

// GET /beneficiaries/:beneficiary - Get all wills + shares where this address is listed as beneficiary
app.get('/beneficiaries/:beneficiary', (req, res) => {
    try {
        const { beneficiary } = req.params;
        
        if (!isValidAddress(beneficiary)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid beneficiary address format'
            });
        }
        
        const beneficiaryWills = getBeneficiaryWills(beneficiary);
        
        res.json({
            success: true,
            data: beneficiaryWills,
            count: beneficiaryWills.length
        });
        
    } catch (error) {
        handleError(res, error, 'Failed to fetch beneficiary wills');
    }
});

// GET /vaults/:willId - Get locked + flexible balances for a will
app.get('/vaults/:willId', (req, res) => {
    try {
        const { willId } = req.params;
        
        if (!isValidAddress(willId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid will ID format (should be testator address)'
            });
        }
        
        const vaults = getVaults(willId);
        
        // Transform array to object for easier consumption
        const vaultBalances = {};
        vaults.forEach(vault => {
            vaultBalances[vault.vaultType] = vault.balance;
        });
        
        res.json({
            success: true,
            data: {
                willId,
                vaults: vaultBalances,
                rawData: vaults
            }
        });
        
    } catch (error) {
        handleError(res, error, 'Failed to fetch vault balances');
    }
});

// GET /documents/:willId - Get all documents for a will
app.get('/documents/:willId', (req, res) => {
    try {
        const { willId } = req.params;
        
        if (!isValidAddress(willId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid will ID format (should be testator address)'
            });
        }
        
        const documents = getDocuments(willId);
        
        res.json({
            success: true,
            data: {
                willId,
                documents,
                count: documents.length
            }
        });
        
    } catch (error) {
        handleError(res, error, 'Failed to fetch documents');
    }
});

// GET /documents/:willId/:ipfsHash - Get specific document details
app.get('/documents/:willId/:ipfsHash', (req, res) => {
    try {
        const { willId, ipfsHash } = req.params;
        
        if (!isValidAddress(willId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid will ID format (should be testator address)'
            });
        }
        
        if (!isValidIpfsHash(ipfsHash)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid IPFS hash format'
            });
        }
        
        const document = getDocumentByHash(willId, ipfsHash);
        
        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }
        
        res.json({
            success: true,
            data: document
        });
        
    } catch (error) {
        handleError(res, error, 'Failed to fetch document');
    }
});

// GET /stats - Get overall statistics
app.get('/stats', (req, res) => {
    try {
        const { getDatabase } = require('./db');
        const db = getDatabase();
        
        const stats = {
            totalWills: db.prepare('SELECT COUNT(*) as count FROM Wills').get().count,
            executedWills: db.prepare('SELECT COUNT(*) as count FROM Wills WHERE executed = 1').get().count,
            activeWills: db.prepare('SELECT COUNT(*) as count FROM Wills WHERE executed = 0').get().count,
            totalBeneficiaries: db.prepare('SELECT COUNT(DISTINCT beneficiary) as count FROM Beneficiaries').get().count,
            totalDocuments: db.prepare('SELECT COUNT(*) as count FROM Documents').get().count,
            totalVaultValue: {
                locked: db.prepare('SELECT SUM(CAST(balance AS INTEGER)) as total FROM Vaults WHERE vaultType = "locked"').get().total || 0,
                flexible: db.prepare('SELECT SUM(CAST(balance AS INTEGER)) as total FROM Vaults WHERE vaultType = "flexible"').get().total || 0
            },
            documentsByType: db.prepare(`
                SELECT documentType, COUNT(*) as count 
                FROM Documents 
                GROUP BY documentType 
                ORDER BY count DESC
            `).all()
        };
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        handleError(res, error, 'Failed to fetch statistics');
    }
});

// Global error handler
app.use((error, req, res, next) => {
    handleError(res, error, 'Unexpected server error');
});

function startAPI() {
    const server = app.listen(PORT, () => {
        console.log(`🚀 Will Management API server running on port ${PORT}`);
        console.log(`📍 Health check: http://localhost:${PORT}/health`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('🔄 Shutting down API server...');
        server.close(() => {
            console.log('✅ API server closed');
        });
    });
    
    process.on('SIGINT', () => {
        console.log('🔄 Shutting down API server...');
        server.close(() => {
            console.log('✅ API server closed');
        });
    });
    
    return server;
}

module.exports = {
    startAPI,
    app
};
