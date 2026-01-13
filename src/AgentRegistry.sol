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
    error NotOwner();
    error AgentAlreadyRegistered();
    error AgentNotRegistered();
    error AgentAlreadyActive();
    error AgentAlreadyInactive();
    error ZeroAddress();

    struct Agent {
        address owner;
        bool active;
    }

    mapping(address => Agent) private agents;

    event AgentRegistered(address indexed agent, address indexed owner);
    event AgentRevoked(address indexed agent);
    event AgentReactivated(address indexed agent);

    function registerAgent(address agent) external {
        if (agent == address(0)) {
            revert ZeroAddress();
        }

        Agent storage a = agents[agent];

        if (a.owner != address(0)) {
            revert AgentAlreadyRegistered();
        }

        a.owner = msg.sender;
        a.active = true;

        emit AgentRegistered(agent, msg.sender);
    }

    function revokeAgent(address agent) external {
        Agent storage a = agents[agent];

        if (a.owner == address(0)) {
            revert AgentNotRegistered();
        }

        if (a.owner != msg.sender) {
            revert NotOwner();
        }

        if (!a.active) {
            revert AgentAlreadyInactive();
        }

        a.active = false;

        emit AgentRevoked(agent);
    }

    function reactivateAgent(address agent) external {
        Agent storage a = agents[agent];

        if (a.owner == address(0)) {
            revert AgentNotRegistered();
        }

        if (a.owner != msg.sender) {
            revert NotOwner();
        }

        if (a.active) {
            revert AgentAlreadyActive();
        }

        a.active = true;

        emit AgentReactivated(agent);
    }

    function getAgent(address agent) external view returns (address owner, bool active) {
        Agent storage a = agents[agent];
        return (a.owner, a.active);
    }

    //////////////////////
    /// External view Functions
    //////////////////////
    function isAgentActive(address agent) external view returns (bool) {
        return agents[agent].active;
    }
}
