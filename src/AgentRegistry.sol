// Layout of Contract:
// version
// imports
// errors
// interfaces, libraries, contracts
// Type declarations
// State variables
// Events
// Modifiers
// Functions

// Layout of Functions:
// constructor
// receive function (if exists)
// fallback function (if exists)
// external
// public
// internal
// private
// internal & private view & pure functions
// external & public view & pure functions

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract AgentRegistry {

    struct Agent {
        address owner;
        bool active;
    }

    mapping(address => Agent) private agents;

    event AgentRegistered(address indexed agent, address indexed owner);
    event AgentRevoked(address indexed agent);
    event AgentReactivated(address indexed agent);

    function getAgent(address agent) external view returns (address owner, bool active) {}

    function registerAgent(address agent) external {}

    function revokeAgent(address agent) external {}

    function reactivateAgent(address agent) external {}
}