const { initializeDatabase } = require('./db');
const { startIndexer } = require('./indexer');
const { startAPI } = require('./api');

async function main() {
    try {
        console.log('🏁 Starting Will Management Indexer...');
        
        // Initialize database
        console.log('📊 Initializing database...');
        initializeDatabase();
        
        // Start the blockchain indexer
        console.log('⛓️ Starting blockchain indexer...');
        await startIndexer();
        
        // Start API server
        console.log('🚀 Starting API server...');
        startAPI();
        
        console.log('✅ Will Management Indexer is running!');
        
    } catch (error) {
        console.error('❌ Failed to start indexer:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🔄 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

main();