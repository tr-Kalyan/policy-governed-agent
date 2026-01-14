// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {TreasuryWithPolicy} from "../src/TreasuryWithPolicy.sol";

contract DeployArc is Script {
    function run() external returns (address, address) {
        vm.startBroadcast();

        AgentRegistry registry = new AgentRegistry();
        console2.log("AgentRegistry: ", address(registry));

        address ARC_USDC = vm.envAddress("ARC_USDC");
        require(ARC_USDC != address(0), "ARC_USDC not set");

        TreasuryWithPolicy treasury = new TreasuryWithPolicy(ARC_USDC, address(registry));

        treasury.updatePolicy(
            100e6, // $100 per tx
            500e6, // $500 daily
            1 hours // 1h cooldown
        );
        console2.log("Policy configured");

        vm.stopBroadcast();

        console2.log("AgentRegistry deployed at:", address(registry));
        console2.log("TreasuryWithPolicy deployed at:", address(treasury));

        return (address(registry), address(treasury));
    }
}
