// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/DecentralizedWillManager.sol";

contract DeployWillManager is Script {
    function run() external {
        // Start broadcasting transactions
        vm.startBroadcast();

        // Deploy contract
        DecentralizedWillManager willManager = new DecentralizedWillManager();

        // Stop broadcasting
        vm.stopBroadcast();
    }
}
