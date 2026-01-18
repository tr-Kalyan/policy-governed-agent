// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry registry;

    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address attacker = makeAddr("attacker");

    function setUp() public {
        vm.prank(owner);
        registry = new AgentRegistry();
    }

    function testRegisterAgent() public {
        vm.prank(owner);
        registry.registerAgent(agent);

        (address registeredOwner, bool active) = registry.getAgent(agent);

        assertEq(registeredOwner, owner);
        assertTrue(active);
    }

    function testRegisterAgentZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.registerAgent(address(0));
    }

    function testCannotRegisterSameAgentTwice() public {
        vm.prank(owner);
        registry.registerAgent(agent);

        vm.prank(owner);
        vm.expectRevert(AgentRegistry.AgentAlreadyRegistered.selector);
        registry.registerAgent(agent);
    }

    function testOnlyOwnerCanRevokeAgent() public {
        vm.prank(owner);
        registry.registerAgent(agent);

        vm.prank(attacker);
        vm.expectRevert(AgentRegistry.NotOwner.selector);
        registry.revokeAgent(agent);
    }

    function testRevokeAgentMarksInactive() public {
        vm.prank(owner);
        registry.registerAgent(agent);

        vm.prank(owner);
        registry.revokeAgent(agent);

        (, bool active) = registry.getAgent(agent);
        assertFalse(active);
    }

    function testOnlyOwnerCanReactivateAgent() public {
        vm.prank(owner);
        registry.registerAgent(agent);

        vm.prank(owner);
        registry.revokeAgent(agent);

        vm.prank(attacker);
        vm.expectRevert(AgentRegistry.NotOwner.selector);
        registry.reactivateAgent(agent);
    }

    function testReactivateAgentMarksActive() public {
        vm.prank(owner);
        registry.registerAgent(agent);

        vm.prank(owner);
        registry.revokeAgent(agent);

        vm.prank(owner);
        registry.reactivateAgent(agent);

        (, bool active) = registry.getAgent(agent);
        assertTrue(active);
    }
}
