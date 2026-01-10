// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract TreasuryWithPolicy {

    struct PaymentIntent {
        address agent;
        address recipient;
        uint256 amount;
        uint256 nonce;
    }

    struct Policy {
        uint256 perTxLimit;
        uint256 dailyLimit;
        uint256 cooldown;
    }

    IERC20 public immutable usdc;
    address public owner;
    address public agentRegistry;

    Policy public policy;

    mapping(address => bool) public allowedRecipients;
    mapping(address => uint256) public lastPaymentTime;
    mapping(address => uint256) public dailySpent;
    mapping(address => uint256) public lastDailyReset;
    mapping(address => uint256) public usedNonces;

    event PaymentExecuted(
        address indexed agent,
        address indexed recipient,
        uint256 amount,
        uint256 nonce
    );

    event PaymentRejected(
        address indexed agent,
        address indexed recipient,
        uint256 amount,
        uint256 nonce,
        string reason
    );

    event PolicyUpdated(uint256 perTxLimit, uint256 dailyLimit, uint256 cooldown);
    event RecipientAllowed(address recipient);
    event RecipientRemoved(address recipient);

    function validateIntent(PaymentIntent calldata intent) external view returns (bool valid, string memory reason) {}

    function executePayment(PaymentIntent calldata intent) external {}

    function updatePolicy(
        uint256 perTxLimit,
        uint256 dailyLimit,
        uint256 cooldown
    ) external  {}

    function allowRecipient(address recipient) external {}
    function removeRecipient(address recipient) external {}

    function pause() external {}
    function unpause() external {}

}