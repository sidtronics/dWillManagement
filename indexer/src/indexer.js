const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const {
    createWill,
    updateLastCheckIn,
    executeWill,
    addBeneficiary,
    removeBeneficiary,
    updateBeneficiary,
    updateVaultBalance,
    addDocument,
    removeDocument
} = require('./db');

// Configuration - adjust these for your local testnet
const RPC_URL = 'ws://localhost:8545';
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const CONTRACT_ABI = require('../../contract/out/DecentralizedWillManager.sol/DecentralizedWillManager.json').abi;

let provider;
let contract;

async function startIndexer() {
    try {
        // Connect to blockchain
        provider = new ethers.WebSocketProvider(RPC_URL);
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        
        // Test connection
        const network = await provider.getNetwork();
        console.log(`📡 Connected to network: ${network.name} (chainId: ${network.chainId})`);
        console.log(`📋 Contract address: ${CONTRACT_ADDRESS}`);
        
        // Set up event listeners
        setupEventListeners();
        
        // Optionally sync historical events
        await syncHistoricalEvents();

        // Auto-reconnect
        // provider._websocket.on('close', () => {
        //     console.warn('⚠️ WebSocket closed. Reconnecting...');
        //     setTimeout(startIndexer, 2000);
        // });
        
        console.log('👂 Indexer is listening for events...');
        
    } catch (error) {
        console.error('❌ Failed to start indexer:', error);
        throw error;
    }
}

function setupEventListeners() {
    // WillCreated event
    contract.on('WillCreated', (testator, checkInPeriod, disputePeriod, event) => {
        try {
            console.log(`📝 WillCreated: ${testator}`);
            createWill(testator, Number(checkInPeriod), Number(disputePeriod));
        } catch (error) {
            console.error('Error handling WillCreated event:', error);
        }
    });

    // CheckIn event
    contract.on('CheckIn', (testator, timestamp, event) => {
        try {
            console.log(`⏰ CheckIn: ${testator} at ${timestamp}`);
            updateLastCheckIn(testator, Number(timestamp));
        } catch (error) {
            console.error('Error handling CheckIn event:', error);
        }
    });

    // WillExecuted event
    contract.on('WillExecuted', (testator, totalDistributed, event) => {
        try {
            console.log(`⚖️ WillExecuted: ${testator}, distributed: ${totalDistributed}`);
            executeWill(testator);
        } catch (error) {
            console.error('Error handling WillExecuted event:', error);
        }
    });

    // BeneficiaryAdded event
    contract.on('BeneficiaryAdded', (testator, beneficiary, share, isGuardian, event) => {
        try {
            console.log(`👤 BeneficiaryAdded: ${beneficiary} to ${testator}, share: ${share}, guardian: ${isGuardian}`);
            addBeneficiary(testator, beneficiary, Number(share), isGuardian);
        } catch (error) {
            console.error('Error handling BeneficiaryAdded event:', error);
        }
    });

    // BeneficiaryRemoved event
    contract.on('BeneficiaryRemoved', (testator, beneficiary, event) => {
        try {
            console.log(`👤 BeneficiaryRemoved: ${beneficiary} from ${testator}`);
            removeBeneficiary(testator, beneficiary);
        } catch (error) {
            console.error('Error handling BeneficiaryRemoved event:', error);
        }
    });

    // BeneficiaryUpdated event
    contract.on('BeneficiaryUpdated', (testator, beneficiary, newShare, isGuardian, event) => {
        try {
            console.log(`👤 BeneficiaryUpdated: ${beneficiary} in ${testator}, new share: ${newShare}, guardian: ${isGuardian}`);
            updateBeneficiary(testator, beneficiary, Number(newShare), isGuardian);
        } catch (error) {
            console.error('Error handling BeneficiaryUpdated event:', error);
        }
    });

    // DepositLocked event
    contract.on('DepositLocked', (testator, amount, event) => {
        try {
            console.log(`💰 DepositLocked: ${testator}, amount: ${amount}`);
            updateVaultBalance(testator, 'locked', amount.toString(), true);
        } catch (error) {
            console.error('Error handling DepositLocked event:', error);
        }
    });

    // DepositFlexible event
    contract.on('DepositFlexible', (testator, amount, event) => {
        try {
            console.log(`💰 DepositFlexible: ${testator}, amount: ${amount}`);
            updateVaultBalance(testator, 'flexible', amount.toString(), true);
        } catch (error) {
            console.error('Error handling DepositFlexible event:', error);
        }
    });

    // WithdrawFlexible event
    contract.on('WithdrawFlexible', (testator, amount, event) => {
        try {
            console.log(`💰 WithdrawFlexible: ${testator}, amount: ${amount}`);
            updateVaultBalance(testator, 'flexible', amount.toString(), false);
        } catch (error) {
            console.error('Error handling WithdrawFlexible event:', error);
        }
    });

    // DisputeStarted event (for logging purposes)
    contract.on('DisputeStarted', (testator, disputeDeadline, event) => {
        try {
            console.log(`⚠️ DisputeStarted: ${testator}, deadline: ${disputeDeadline}`);
            // Note: This doesn't update database as disputes are not stored in current schema
            // Add dispute tracking to schema if needed
        } catch (error) {
            console.error('Error handling DisputeStarted event:', error);
        }
    });

    // DocumentAdded event
    contract.on('DocumentAdded', (testator, ipfsHash, fileName, documentType, event) => {
        try {
            console.log(`📄 DocumentAdded: ${fileName} (${documentType}) to ${testator}`);
            console.log(`   IPFS Hash: ${ipfsHash}`);
            
            // Get block timestamp for uploadedAt
            event.getBlock().then(block => {
                addDocument(testator, ipfsHash, fileName, documentType, block.timestamp);
            }).catch(err => {
                console.error('Error getting block timestamp:', err);
                // Fallback to current timestamp
                addDocument(testator, ipfsHash, fileName, documentType, Math.floor(Date.now() / 1000));
            });
        } catch (error) {
            console.error('Error handling DocumentAdded event:', error);
        }
    });

    // DocumentRemoved event
    contract.on('DocumentRemoved', (testator, ipfsHash, event) => {
        try {
            console.log(`📄 DocumentRemoved: ${ipfsHash} from ${testator}`);
            removeDocument(testator, ipfsHash);
        } catch (error) {
            console.error('Error handling DocumentRemoved event:', error);
        }
    });

    console.log('✅ Event listeners configured for all contract events');
}

async function syncHistoricalEvents() {
    try {
        console.log('🔄 Syncing historical events...');
        
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000); // Sync last 10k blocks
        
        const filter = {
            address: CONTRACT_ADDRESS,
            fromBlock,
            toBlock: 'latest'
        };
        
        const logs = await provider.getLogs(filter);
        console.log(`📚 Found ${logs.length} historical events to process`);
        
        for (const log of logs) {
            try {
                const parsedLog = contract.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                });
                
                await processHistoricalEvent(parsedLog, log);
            } catch (error) {
                console.warn('⚠️ Could not parse log:', error.message);
            }
        }
        
        console.log('✅ Historical events sync completed');
    } catch (error) {
        console.warn('⚠️ Historical sync failed:', error.message);
        // Continue without historical sync
    }
}

async function processHistoricalEvent(parsedLog, log) {
    const { name, args } = parsedLog;
    
    try {
        switch (name) {
            case 'WillCreated':
                createWill(args.testator, Number(args.checkInPeriod), Number(args.disputePeriod));
                break;
                
            case 'CheckIn':
                updateLastCheckIn(args.testator, Number(args.timestamp));
                break;
                
            case 'WillExecuted':
                executeWill(args.testator);
                break;
                
            case 'BeneficiaryAdded':
                addBeneficiary(args.testator, args.beneficiary, Number(args.share), args.isGuardian);
                break;
                
            case 'BeneficiaryRemoved':
                removeBeneficiary(args.testator, args.beneficiary);
                break;
                
            case 'BeneficiaryUpdated':
                updateBeneficiary(args.testator, args.beneficiary, Number(args.newShare), args.isGuardian);
                break;
                
            case 'DepositLocked':
                updateVaultBalance(args.testator, 'locked', args.amount.toString(), true);
                break;
                
            case 'DepositFlexible':
                updateVaultBalance(args.testator, 'flexible', args.amount.toString(), true);
                break;
                
            case 'WithdrawFlexible':
                updateVaultBalance(args.testator, 'flexible', args.amount.toString(), false);
                break;
                
            case 'DisputeStarted':
                console.log(`⚠️ Historical DisputeStarted: ${args.testator}`);
                break;
                
            case 'DocumentAdded':
                // Get block to extract timestamp
                const block = await provider.getBlock(log.blockNumber);
                addDocument(args.testator, args.ipfsHash, args.fileName, args.documentType, block.timestamp);
                break;
                
            case 'DocumentRemoved':
                removeDocument(args.testator, args.ipfsHash);
                break;
                
            default:
                console.log(`❓ Unknown event: ${name}`);
        }
    } catch (error) {
        console.error(`Error processing historical ${name} event:`, error);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 Shutting down indexer...');
    if (contract) {
        contract.removeAllListeners();
    }
    if (provider && provider._websocket) {
        provider._websocket.close();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🔄 Shutting down indexer...');
    if (contract) {
        contract.removeAllListeners();
    }
    if (provider && provider._websocket) {
        provider._websocket.close();
    }
    process.exit(0);
});

module.exports = {
    startIndexer
};
