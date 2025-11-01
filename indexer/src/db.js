const Database = require('better-sqlite3');
const path = require('path');

let db;

function initializeDatabase() {
    db = new Database(path.join(__dirname, '..', 'wills.db'));
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Create tables
    createTables();
    
    console.log('✅ Database initialized successfully');
}

function createTables() {
    // Wills table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Wills (
            willId TEXT PRIMARY KEY,
            testator TEXT NOT NULL,
            guardian TEXT,
            checkInPeriod INTEGER,
            disputePeriod INTEGER,
            lastCheckIn INTEGER,
            executed INTEGER DEFAULT 0,
            createdAt INTEGER,
            updatedAt INTEGER
        )
    `);

    // Beneficiaries table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Beneficiaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            willId TEXT NOT NULL,
            beneficiary TEXT NOT NULL,
            share INTEGER NOT NULL,
            UNIQUE (willId, beneficiary),
            FOREIGN KEY (willId) REFERENCES Wills(willId)
        )
    `);

    // Vaults table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Vaults (
            willId TEXT NOT NULL,
            vaultType TEXT CHECK(vaultType IN ('locked','flexible')),
            balance TEXT NOT NULL,
            PRIMARY KEY (willId, vaultType),
            FOREIGN KEY (willId) REFERENCES Wills(willId)
        )
    `);

    // Documents table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            willId TEXT NOT NULL,
            ipfsHash TEXT NOT NULL,
            fileName TEXT NOT NULL,
            documentType TEXT NOT NULL,
            uploadedAt INTEGER NOT NULL,
            UNIQUE (willId, ipfsHash),
            FOREIGN KEY (willId) REFERENCES Wills(willId)
        )
    `);

    console.log('✅ Database tables created/verified');
}

// Will operations
function createWill(testator, checkInPeriod, disputePeriod) {
    const willId = testator.toLowerCase();
    const now = Math.floor(Date.now() / 1000);
    
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO Wills 
        (willId, testator, checkInPeriod, disputePeriod, lastCheckIn, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(willId, testator.toLowerCase(), checkInPeriod, disputePeriod, now, now, now);
    
    // Initialize vault balances to 0
    initializeVaults(willId);
    
    console.log(`📝 Created will for testator: ${testator}`);
}

function initializeVaults(willId) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO Vaults (willId, vaultType, balance)
        VALUES (?, ?, ?)
    `);
    
    stmt.run(willId, 'locked', '0');
    stmt.run(willId, 'flexible', '0');
}

function updateLastCheckIn(testator, timestamp) {
    const stmt = db.prepare(`
        UPDATE Wills 
        SET lastCheckIn = ?, updatedAt = ?
        WHERE testator = ?
    `);
    
    const now = Math.floor(Date.now() / 1000);
    stmt.run(timestamp, now, testator.toLowerCase());
    
    console.log(`⏰ Updated check-in for testator: ${testator}`);
}

function executeWill(testator) {
    const stmt = db.prepare(`
        UPDATE Wills 
        SET executed = 1, updatedAt = ?
        WHERE testator = ?
    `);
    
    const now = Math.floor(Date.now() / 1000);
    stmt.run(now, testator.toLowerCase());
    
    console.log(`⚖️ Executed will for testator: ${testator}`);
}

// Beneficiary operations
function addBeneficiary(testator, beneficiary, share, isGuardian) {
    const willId = testator.toLowerCase();
    
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO Beneficiaries (willId, beneficiary, share)
        VALUES (?, ?, ?)
    `);
    
    stmt.run(willId, beneficiary.toLowerCase(), share);
    
    // Update guardian if applicable
    if (isGuardian) {
        updateGuardian(willId, beneficiary);
    }
    
    console.log(`👤 Added beneficiary ${beneficiary} to will ${willId} with share ${share}`);
}

function removeBeneficiary(testator, beneficiary) {
    const willId = testator.toLowerCase();
    
    const stmt = db.prepare(`
        DELETE FROM Beneficiaries
        WHERE willId = ? AND beneficiary = ?
    `);
    
    stmt.run(willId, beneficiary.toLowerCase());
    
    // Remove as guardian if applicable
    const guardianStmt = db.prepare(`
        UPDATE Wills 
        SET guardian = NULL, updatedAt = ?
        WHERE willId = ? AND guardian = ?
    `);
    
    const now = Math.floor(Date.now() / 1000);
    guardianStmt.run(now, willId, beneficiary.toLowerCase());
    
    console.log(`👤 Removed beneficiary ${beneficiary} from will ${willId}`);
}

function updateBeneficiary(testator, beneficiary, newShare, isGuardian) {
    const willId = testator.toLowerCase();
    
    const stmt = db.prepare(`
        UPDATE Beneficiaries 
        SET share = ?
        WHERE willId = ? AND beneficiary = ?
    `);
    
    stmt.run(newShare, willId, beneficiary.toLowerCase());
    
    // Update guardian if applicable
    if (isGuardian) {
        updateGuardian(willId, beneficiary);
    }
    
    console.log(`👤 Updated beneficiary ${beneficiary} in will ${willId} with new share ${newShare}`);
}

function updateGuardian(willId, guardian) {
    const stmt = db.prepare(`
        UPDATE Wills 
        SET guardian = ?, updatedAt = ?
        WHERE willId = ?
    `);
    
    const now = Math.floor(Date.now() / 1000);
    stmt.run(guardian.toLowerCase(), now, willId);
}

// Vault operations
function updateVaultBalance(testator, vaultType, amount, isDeposit = true) {
    const willId = testator.toLowerCase();
    
    // Get current balance
    const selectStmt = db.prepare(`
        SELECT balance FROM Vaults
        WHERE willId = ? AND vaultType = ?
    `);
    
    const result = selectStmt.get(willId, vaultType);
    const currentBalance = BigInt(result ? result.balance : '0');
    const changeAmount = BigInt(amount);
    
    const newBalance = isDeposit 
        ? currentBalance + changeAmount 
        : currentBalance - changeAmount;
    
    // Ensure balance doesn't go negative
    const finalBalance = newBalance < 0n ? 0n : newBalance;
    
    const updateStmt = db.prepare(`
        INSERT OR REPLACE INTO Vaults (willId, vaultType, balance)
        VALUES (?, ?, ?)
    `);
    
    updateStmt.run(willId, vaultType, finalBalance.toString());
    
    const operation = isDeposit ? 'Deposited' : 'Withdrew';
    console.log(`💰 ${operation} ${amount} to ${vaultType} vault for testator: ${testator}`);
}

// Document operations
function addDocument(testator, ipfsHash, fileName, documentType, uploadedAt) {
    const willId = testator.toLowerCase();
    
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO Documents (willId, ipfsHash, fileName, documentType, uploadedAt)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(willId, ipfsHash, fileName, documentType, uploadedAt);
    
    console.log(`📄 Added document ${fileName} (${ipfsHash}) to will ${willId}`);
}

function removeDocument(testator, ipfsHash) {
    const willId = testator.toLowerCase();
    
    const stmt = db.prepare(`
        DELETE FROM Documents
        WHERE willId = ? AND ipfsHash = ?
    `);
    
    const result = stmt.run(willId, ipfsHash);
    
    if (result.changes > 0) {
        console.log(`📄 Removed document ${ipfsHash} from will ${willId}`);
    } else {
        console.log(`⚠️ Document ${ipfsHash} not found in will ${willId}`);
    }
}

function getDocuments(willId) {
    const stmt = db.prepare(`
        SELECT ipfsHash, fileName, documentType, uploadedAt 
        FROM Documents
        WHERE willId = ?
        ORDER BY uploadedAt DESC
    `);
    
    return stmt.all(willId.toLowerCase());
}

function getDocumentByHash(willId, ipfsHash) {
    const stmt = db.prepare(`
        SELECT * FROM Documents
        WHERE willId = ? AND ipfsHash = ?
    `);
    
    return stmt.get(willId.toLowerCase(), ipfsHash);
}

// Query functions for API
function getWillsByTestator(testator) {
    const stmt = db.prepare(`
        SELECT * FROM Wills
        WHERE testator = ?
    `);
    
    return stmt.all(testator.toLowerCase());
}

function getWillsByBeneficiary(beneficiary) {
    const stmt = db.prepare(`
        SELECT w.*, b.share FROM Wills w
        JOIN Beneficiaries b ON w.willId = b.willId
        WHERE b.beneficiary = ?
    `);
    
    return stmt.all(beneficiary.toLowerCase());
}

function getWillDetails(willId) {
    const willStmt = db.prepare(`
        SELECT * FROM Wills
        WHERE willId = ?
    `);
    
    const beneficiariesStmt = db.prepare(`
        SELECT beneficiary, share FROM Beneficiaries
        WHERE willId = ?
    `);
    
    const vaultsStmt = db.prepare(`
        SELECT vaultType, balance FROM Vaults
        WHERE willId = ?
    `);
    
    const documentsStmt = db.prepare(`
        SELECT ipfsHash, fileName, documentType, uploadedAt FROM Documents
        WHERE willId = ?
        ORDER BY uploadedAt DESC
    `);
    
    const will = willStmt.get(willId.toLowerCase());
    if (!will) return null;
    
    const beneficiaries = beneficiariesStmt.all(willId.toLowerCase());
    const vaults = vaultsStmt.all(willId.toLowerCase());
    const documents = documentsStmt.all(willId.toLowerCase());
    
    return {
        ...will,
        beneficiaries,
        vaults,
        documents
    };
}

function getBeneficiaryWills(beneficiary) {
    const stmt = db.prepare(`
        SELECT w.willId, w.testator, w.executed, b.share FROM Wills w
        JOIN Beneficiaries b ON w.willId = b.willId
        WHERE b.beneficiary = ?
    `);
    
    return stmt.all(beneficiary.toLowerCase());
}

function getVaults(willId) {
    const stmt = db.prepare(`
        SELECT vaultType, balance FROM Vaults
        WHERE willId = ?
    `);
    
    return stmt.all(willId.toLowerCase());
}

function getDatabase() {
    return db;
}

module.exports = {
    initializeDatabase,
    createWill,
    updateLastCheckIn,
    executeWill,
    addBeneficiary,
    removeBeneficiary,
    updateBeneficiary,
    updateVaultBalance,
    addDocument,
    removeDocument,
    getDocuments,
    getDocumentByHash,
    getWillsByTestator,
    getWillsByBeneficiary,
    getWillDetails,
    getBeneficiaryWills,
    getVaults,
    getDatabase
};
