// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AgentRegistry} from "./AgentRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TreasuryWithPolicy {
    using SafeERC20 for IERC20;

    error NotOwner();
    error AgentNotAuthorized();
    error RecipientNotAllowed();
    error AmountExceedsPerTxLimit();
    error DailyLimitExceeded();
    error CooldownNotPassed();
    error NonceAlreadyUsed();
    error TreasuryPaused();

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

    IERC20 public immutable USDC;
    address public owner;
    address public agentRegistry;

    Policy public policy;
    bool public paused;

    mapping(address => bool) public allowedRecipients;
    mapping(address => uint256) public lastPaymentTime;
    mapping(address => uint256) public dailySpent;
    mapping(address => uint256) public lastDailyReset;
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    event PaymentExecuted(address indexed agent, address indexed recipient, uint256 amount, uint256 nonce);

    event PaymentRejected(
        address indexed agent, address indexed recipient, uint256 amount, uint256 nonce, string reason
    );

    event PolicyUpdated(uint256 perTxLimit, uint256 dailyLimit, uint256 cooldown);
    event RecipientAllowed(address recipient);
    event RecipientRemoved(address recipient);
    event Paused();
    event Unpaused();

    constructor(address _usdc, address _agentRegistry) {
        require(_usdc != address(0) && _agentRegistry != address(0), "zero address");

        USDC = IERC20(_usdc);
        agentRegistry = _agentRegistry;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function validateIntent(PaymentIntent calldata intent) external view returns (bool valid, string memory reason) {
        if (paused) return (false, "paused");
        if (!allowedRecipients[intent.recipient]) return (false, "recipient not allowed");
        if (intent.amount > policy.perTxLimit) return (false, "per-tx limit exceeded");
        if (usedNonces[intent.agent][intent.nonce]) {
            return (false, "nonce used");
        }

        return (true, "");
    }

    function executePayment(PaymentIntent calldata intent) external {
        if (paused) revert TreasuryPaused();

        // Identity check via registry
        (, bool active) = AgentRegistry(agentRegistry).getAgent(intent.agent);

        if (!active) revert AgentNotAuthorized();

        // Replay protection
        if (usedNonces[intent.agent][intent.nonce]) revert NonceAlreadyUsed();

        // Recipient check
        if (!allowedRecipients[intent.recipient]) revert RecipientNotAllowed();

        // Amount checks
        if (intent.amount > policy.perTxLimit) revert AmountExceedsPerTxLimit();

        _resetDailySpentIfNeeded(intent.agent);

        if (dailySpent[intent.agent] + intent.amount > policy.dailyLimit) {
            revert DailyLimitExceeded();
        }

        // Cooldown check
        if (lastPaymentTime[intent.agent] != 0 && block.timestamp < lastPaymentTime[intent.agent] + policy.cooldown) {
            revert CooldownNotPassed();
        }

        // ---- effects ----
        usedNonces[intent.agent][intent.nonce] = true;
        dailySpent[intent.agent] += intent.amount;
        lastPaymentTime[intent.agent] = block.timestamp;

        // ---- interaction ----
        USDC.safeTransfer(intent.recipient, intent.amount);

        emit PaymentExecuted(intent.agent, intent.recipient, intent.amount, intent.nonce);
    }

    function updatePolicy(uint256 perTxLimit, uint256 dailyLimit, uint256 cooldown) external onlyOwner {
        if (paused) revert TreasuryPaused();

        require(perTxLimit > 0, "perTxLimit=0");
        require(dailyLimit >= perTxLimit, "daily < perTx");

        policy = Policy({perTxLimit: perTxLimit, dailyLimit: dailyLimit, cooldown: cooldown});

        emit PolicyUpdated(perTxLimit, dailyLimit, cooldown);
    }

    function allowRecipient(address recipient) external onlyOwner {
        if (paused) revert TreasuryPaused();

        allowedRecipients[recipient] = true;
        emit RecipientAllowed(recipient);
    }

    function removeRecipient(address recipient) external onlyOwner {
        if (paused) revert TreasuryPaused();

        allowedRecipients[recipient] = false;
        emit RecipientRemoved(recipient);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    //////////////////////
    /// Internal Functions
    //////////////////////

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function _resetDailySpentIfNeeded(address agent) internal {
        if (block.timestamp > lastDailyReset[agent] + 1 days) {
            dailySpent[agent] = 0;
            lastDailyReset[agent] = block.timestamp;
        }
    }

    //////////////////////
    /// External view Functions
    //////////////////////

    function getPolicyLimits() external view returns (uint256, uint256, uint256) {
        return (policy.perTxLimit, policy.dailyLimit, policy.cooldown);
    }

    function getAgentSpendingStatus(address agent) external view returns (uint256 spent, uint256 lastReset) {
        return (dailySpent[agent], lastDailyReset[agent]);
    }
}
