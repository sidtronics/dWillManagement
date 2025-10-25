// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title DecentralizedWillManager
 * @dev Master contract for managing multiple wills with dead man's switch and dual vault system
 */
contract DecentralizedWillManager {
    
    // ============ STRUCTS ============
    
    struct Beneficiary {
        address wallet;          // Beneficiary's wallet address
        uint256 share;           // Percentage of inheritance (0-100)
        bool isGuardian;         // Only one guardian per will
    }
    
    struct Will {
        address testator;             // Will owner
        Beneficiary[] beneficiaries;  // Array of beneficiaries
        uint256 lockedVault;          // Cannot be withdrawn by testator
        uint256 flexibleVault;        // Can be withdrawn by testator
        uint256 lastCheckIn;          // Timestamp of last check-in
        uint256 checkInPeriod;        // Seconds between required check-ins
        uint256 disputePeriod;        // Seconds for dispute resolution after deadline
        bool executed;                // Whether will has been executed
    }
    
    // ============ STATE VARIABLES ============
    
    mapping(address => Will) public wills;
    
    // ============ EVENTS ============
    
    event WillCreated(address indexed testator, uint256 checkInPeriod, uint256 disputePeriod);
    event BeneficiaryAdded(address indexed testator, address indexed beneficiary, uint256 share, bool isGuardian);
    event BeneficiaryUpdated(address indexed testator, address indexed beneficiary, uint256 newShare, bool isGuardian);
    event BeneficiaryRemoved(address indexed testator, address indexed beneficiary);
    event DepositLocked(address indexed testator, uint256 amount);
    event DepositFlexible(address indexed testator, uint256 amount);
    event WithdrawFlexible(address indexed testator, uint256 amount);
    event CheckIn(address indexed testator, uint256 timestamp);
    event WillExecuted(address indexed testator, uint256 totalDistributed);
    event DisputeStarted(address indexed testator, uint256 disputeDeadline);
    
    // ============ MODIFIERS ============
    
    modifier onlyTestator(address testator) {
        require(msg.sender == testator, "Only testator can call this function");
        _;
    }
    
    modifier willExists(address testator) {
        require(wills[testator].testator != address(0), "Will does not exist");
        _;
    }
    
    modifier willNotExecuted(address testator) {
        require(!wills[testator].executed, "Will already executed");
        _;
    }
    
    modifier validShare(uint256 share) {
        require(share > 0 && share <= 100, "Share must be between 1-100");
        _;
    }
    
    // ============ WILL LIFECYCLE FUNCTIONS ============
    
    /**
     * @dev Creates a new will for the caller
     * @param checkInPeriod Seconds between required check-ins
     * @param disputePeriod Seconds for dispute resolution
     */
    function createWill(uint256 checkInPeriod, uint256 disputePeriod) external {
        require(wills[msg.sender].testator == address(0), "Will already exists");
        require(checkInPeriod > 0, "Check-in period must be positive");
        require(disputePeriod > 0, "Dispute period must be positive");
        
        Will storage newWill = wills[msg.sender];
        newWill.testator = msg.sender;
        newWill.checkInPeriod = checkInPeriod;
        newWill.disputePeriod = disputePeriod;
        newWill.lastCheckIn = block.timestamp;
        newWill.executed = false;
        
        emit WillCreated(msg.sender, checkInPeriod, disputePeriod);
    }
    
    /**
     * @dev Executes a will and distributes funds to beneficiaries
     * @param testator The testator whose will to execute
     */
    function executeWill(address testator) external willExists(testator) willNotExecuted(testator) {
        Will storage will = wills[testator];
        uint256 currentTime = block.timestamp;
        uint256 deadlineTime = will.lastCheckIn + will.checkInPeriod;
        uint256 disputeEndTime = deadlineTime + will.disputePeriod;
        
        // Execution timing rules:
        // 1. Before deadline: No execution allowed
        // 2. Between deadline and dispute end: Only guardian can execute
        // 3. After dispute period: Any beneficiary can execute
        
        require(currentTime > deadlineTime, "Check-in period has not expired");
        
        if (currentTime <= disputeEndTime) {
            require(_isGuardianOfWill(msg.sender, testator), "Only guardian can execute during dispute period");
        } else {
            require(_isBeneficiaryOfWill(msg.sender, testator), "Only beneficiaries can execute will");
        }
        
        uint256 totalFunds = will.lockedVault + will.flexibleVault;
        require(totalFunds > 0, "No funds to distribute");
        
        require(_getTotalShares(testator) == 100, "Total beneficiary shares must equal 100%");
        
        for (uint256 i = 0; i < will.beneficiaries.length; i++) {
            Beneficiary memory beneficiary = will.beneficiaries[i];
            uint256 amount = (totalFunds * beneficiary.share) / 100;
            
            if (amount > 0) {
                (bool success, ) = beneficiary.wallet.call{value: amount}("");
                require(success, "Transfer failed");
            }
        }
        
        will.executed = true;
        will.lockedVault = 0;
        will.flexibleVault = 0;
        
        emit WillExecuted(testator, totalFunds);
    }
    
    // ============ BENEFICIARY MANAGEMENT ============
    
    /**
     * @dev Adds a beneficiary to the testator's will
     * @param beneficiary Address of the beneficiary
     * @param share Percentage share (1-100)
     * @param isGuardian Whether this beneficiary is the guardian
     */
    function addBeneficiary(address beneficiary, uint256 share, bool isGuardian) 
        external 
        willExists(msg.sender) 
        willNotExecuted(msg.sender)
        validShare(share)
    {
        require(beneficiary != address(0), "Invalid beneficiary address");
        require(beneficiary != msg.sender, "Cannot add self as beneficiary");
        require(!_isBeneficiaryOfWill(beneficiary, msg.sender), "Beneficiary already exists");
        
        if (isGuardian) {
            require(!_hasGuardian(msg.sender), "Guardian already exists");
        }
        
        uint256 currentTotal = _getTotalShares(msg.sender);
        require(currentTotal + share <= 100, "Total shares cannot exceed 100%");
        
        wills[msg.sender].beneficiaries.push(Beneficiary({
            wallet: beneficiary,
            share: share,
            isGuardian: isGuardian
        }));
        
        emit BeneficiaryAdded(msg.sender, beneficiary, share, isGuardian);
    }
    
    /**
     * @dev Updates an existing beneficiary's details
     * @param beneficiary Address of the beneficiary to update
     * @param newShare New percentage share
     * @param isGuardian New guardian status
     */
    function updateBeneficiary(address beneficiary, uint256 newShare, bool isGuardian) 
        external 
        willExists(msg.sender) 
        willNotExecuted(msg.sender)
        validShare(newShare)
    {
        require(_isBeneficiaryOfWill(beneficiary, msg.sender), "Beneficiary not found");
        
        Will storage will = wills[msg.sender];
        uint256 beneficiaryIndex = _getBeneficiaryIndex(beneficiary, msg.sender);
        Beneficiary storage targetBeneficiary = will.beneficiaries[beneficiaryIndex];
        
        if (isGuardian && !targetBeneficiary.isGuardian) {
            require(!_hasGuardian(msg.sender), "Guardian already exists");
        }
        
        uint256 currentTotal = _getTotalShares(msg.sender);
        uint256 adjustedTotal = currentTotal - targetBeneficiary.share + newShare;
        require(adjustedTotal <= 100, "Total shares cannot exceed 100%");
        
        targetBeneficiary.share = newShare;
        targetBeneficiary.isGuardian = isGuardian;
        
        emit BeneficiaryUpdated(msg.sender, beneficiary, newShare, isGuardian);
    }
    
    /**
     * @dev Removes a beneficiary from the testator's will
     * @param beneficiary Address of the beneficiary to remove
     */
    function removeBeneficiary(address beneficiary) 
        external 
        willExists(msg.sender) 
        willNotExecuted(msg.sender)
    {
        require(_isBeneficiaryOfWill(beneficiary, msg.sender), "Beneficiary not found");
        
        Will storage will = wills[msg.sender];
        uint256 beneficiaryIndex = _getBeneficiaryIndex(beneficiary, msg.sender);
        
        will.beneficiaries[beneficiaryIndex] = will.beneficiaries[will.beneficiaries.length - 1];
        will.beneficiaries.pop();
        
        emit BeneficiaryRemoved(msg.sender, beneficiary);
    }
    
    // ============ VAULT MANAGEMENT ============
    
    /**
     * @dev Deposits funds into the locked vault (cannot be withdrawn)
     */
    function depositLocked() external payable willExists(msg.sender) willNotExecuted(msg.sender) {
        require(msg.value > 0, "Must deposit positive amount");
        
        wills[msg.sender].lockedVault += msg.value;
        
        emit DepositLocked(msg.sender, msg.value);
    }
    
    /**
     * @dev Deposits funds into the flexible vault (can be withdrawn)
     */
    function depositFlexible() external payable willExists(msg.sender) willNotExecuted(msg.sender) {
        require(msg.value > 0, "Must deposit positive amount");
        
        wills[msg.sender].flexibleVault += msg.value;
        
        emit DepositFlexible(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraws funds from the flexible vault
     * @param amount Amount to withdraw
     */
    function withdrawFlexible(uint256 amount) external willExists(msg.sender) willNotExecuted(msg.sender) {
        require(amount > 0, "Must withdraw positive amount");
        require(wills[msg.sender].flexibleVault >= amount, "Insufficient flexible vault balance");
        
        wills[msg.sender].flexibleVault -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit WithdrawFlexible(msg.sender, amount);
    }
    
    // ============ DEAD MAN'S SWITCH ============
    
    /**
     * @dev Testator checks in to reset the timer
     */
    function checkIn() external willExists(msg.sender) willNotExecuted(msg.sender) {
        wills[msg.sender].lastCheckIn = block.timestamp;
        
        emit CheckIn(msg.sender, block.timestamp);
    }
    
    // ============ INTERNAL HELPER FUNCTIONS ============
    
    function _isBeneficiaryOfWill(address user, address testator) internal view returns (bool) {
        Will storage will = wills[testator];
        for (uint256 i = 0; i < will.beneficiaries.length; i++) {
            if (will.beneficiaries[i].wallet == user) {
                return true;
            }
        }
        return false;
    }
    
    function _isGuardianOfWill(address user, address testator) internal view returns (bool) {
        Will storage will = wills[testator];
        for (uint256 i = 0; i < will.beneficiaries.length; i++) {
            if (will.beneficiaries[i].wallet == user && will.beneficiaries[i].isGuardian) {
                return true;
            }
        }
        return false;
    }
    
    function _hasGuardian(address testator) internal view returns (bool) {
        Will storage will = wills[testator];
        for (uint256 i = 0; i < will.beneficiaries.length; i++) {
            if (will.beneficiaries[i].isGuardian) {
                return true;
            }
        }
        return false;
    }
    
    function _getTotalShares(address testator) internal view returns (uint256) {
        Will storage will = wills[testator];
        uint256 total = 0;
        for (uint256 i = 0; i < will.beneficiaries.length; i++) {
            total += will.beneficiaries[i].share;
        }
        return total;
    }
    
    function _getBeneficiaryIndex(address beneficiary, address testator) internal view returns (uint256) {
        Will storage will = wills[testator];
        for (uint256 i = 0; i < will.beneficiaries.length; i++) {
            if (will.beneficiaries[i].wallet == beneficiary) {
                return i;
            }
        }
        revert("Beneficiary not found");
    }
}
