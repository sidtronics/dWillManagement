const express = require('express');
const cors = require('cors');
const {
    getWillsByTestator,
    getWillsByBeneficiary,
    getWillDetails,
    getBeneficiaryWills,
    getVaults
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

// GET /stats - Get overall statistics (bonus endpoint)
app.get('/stats', (req, res) => {
    try {
        const { getDatabase } = require('./db');
        const db = getDatabase();
        
        const stats = {
            totalWills: db.prepare('SELECT COUNT(*) as count FROM Wills').get().count,
            executedWills: db.prepare('SELECT COUNT(*) as count FROM Wills WHERE executed = 1').get().count,
            activeWills: db.prepare('SELECT COUNT(*) as count FROM Wills WHERE executed = 0').get().count,
            totalBeneficiaries: db.prepare('SELECT COUNT(DISTINCT beneficiary) as count FROM Beneficiaries').get().count,
            totalVaultValue: {
                locked: db.prepare('SELECT SUM(CAST(balance AS INTEGER)) as total FROM Vaults WHERE vaultType = "locked"').get().total || 0,
                flexible: db.prepare('SELECT SUM(CAST(balance AS INTEGER)) as total FROM Vaults WHERE vaultType = "flexible"').get().total || 0
            }
        };
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        handleError(res, error, 'Failed to fetch statistics');
    }
});

// 404 handler for undefined routes
// app.use('/*', (req, res) => {
//     res.status(404).json({
//         success: false,
//         error: 'Endpoint not found',
//         availableEndpoints: [
//             'GET /health',
//             'GET /wills/:testator',
//             'GET /wills/beneficiary/:beneficiary', 
//             'GET /will/:id',
//             'GET /beneficiaries/:beneficiary',
//             'GET /vaults/:willId',
//             'GET /stats'
//         ]
//     });
// });

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
