// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {TreasuryWithPolicy} from "../src/TreasuryWithPolicy.sol";

contract TreasuryWithPolicyTest is Test {
    AgentRegistry registry;
    TreasuryWithPolicy treasury;

    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address recipient = makeAddr("recipient");

    MockUSDC usdc;

    function setUp() public {
        vm.startPrank(owner);

        usdc = new MockUSDC();
        registry = new AgentRegistry();
        treasury = new TreasuryWithPolicy(address(usdc), address(registry));

        registry.registerAgent(agent);

        usdc.mint(address(treasury), 1_000_000e6);

        treasury.updatePolicy(
            100e6, // perTxLimit
            500e6, // dailyLimit
            1 hours // cooldown
        );

        treasury.allowRecipient(recipient);

        vm.stopPrank();
    }

    function testExecutePaymentHappyPath() public {
        TreasuryWithPolicy.PaymentIntent memory intent =
            TreasuryWithPolicy.PaymentIntent({agent: agent, recipient: recipient, amount: 50e6, nonce: 1});

        vm.prank(address(0xdead)); // relayer / bot
        treasury.executePayment(intent);

        assertEq(MockUSDC(address(usdc)).balanceOf(recipient), 50e6);
    }

    function testRevokedAgentCannotExecute() public {
        vm.prank(owner);
        registry.revokeAgent(agent);

        TreasuryWithPolicy.PaymentIntent memory intent =
            TreasuryWithPolicy.PaymentIntent({agent: agent, recipient: recipient, amount: 10e6, nonce: 2});

        vm.expectRevert(TreasuryWithPolicy.AgentNotAuthorized.selector);
        treasury.executePayment(intent);
    }

    function testNonceReplayBlocked() public {
        TreasuryWithPolicy.PaymentIntent memory intent =
            TreasuryWithPolicy.PaymentIntent({agent: agent, recipient: recipient, amount: 10e6, nonce: 3});

        treasury.executePayment(intent);

        vm.expectRevert(TreasuryWithPolicy.NonceAlreadyUsed.selector);
        treasury.executePayment(intent);
    }

    function testPauseBlocksExecution() public {
        vm.prank(owner);
        treasury.pause();

        TreasuryWithPolicy.PaymentIntent memory intent =
            TreasuryWithPolicy.PaymentIntent({agent: agent, recipient: recipient, amount: 10e6, nonce: 4});

        vm.expectRevert(TreasuryWithPolicy.TreasuryPaused.selector);
        treasury.executePayment(intent);
    }
}
