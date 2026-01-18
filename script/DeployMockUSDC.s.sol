// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract DeployMockUSDCScript is Script {
    function run() external returns (address) {
        vm.startBroadcast();

        MockUSDC usdc = new MockUSDC();
        console2.log("MockUSDC deployed at:", address(usdc));

        vm.stopBroadcast();

        return address(usdc);
    }
}
