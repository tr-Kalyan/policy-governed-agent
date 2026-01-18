// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal ERC20-compatible USDC mock for testnet demos
/// @dev Intentionally permissionless mint for hackathon testing
contract MockUSDC {
    mapping(address => uint256) public balanceOf;

    function name() external pure returns (string memory) {
        return "Mock USDC";
    }

    function symbol() external pure returns (string memory) {
        return "mUSDC";
    }

    function decimals() external pure returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

