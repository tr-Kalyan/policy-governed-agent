# Policy-Governed Agent Payments (PGAP)

## Overview

PGAP is a trust-minimized agentic payment system built on Arc using USDC. AI agents can propose payments based on context and policy, but never control funds. All enforcement happens on-chain, ensuring deterministic safety even if the agent misbehaves.

**Core principle:** AI proposes. Smart contracts enforce.

This architecture prevents rogue agents, hallucinated payments, and uncontrolled spending—key risks in agentic commerce systems.

## Problem Statement

As AI agents begin to autonomously purchase APIs, data, compute, or services, a critical risk emerges:

* Agents may overspend
* Agents may hallucinate recipients or amounts
* Off-chain safeguards can be bypassed
* Humans lose deterministic control over funds

Existing systems rely on off-chain trust or agent self-restraint, which does not scale safely.

## Design Goals

1. **Trust minimization** — AI never has custody or signing power
2. **Deterministic enforcement** — all payment rules enforced on-chain
3. **Composable agent logic** — any AI model can propose intents
4. **Clear authority boundaries** — identity, policy, treasury separated
5. **Auditability** — every payment is verifiable on Arc

## High-Level Architecture
```
User / Service Request
        ↓
Gemini AI Agent (off-chain)
- reasons about request
- reads policy constraints
- proposes a PaymentIntent
        ↓
Backend Executor (Node.js)
- submits intent
- does not modify intent
        ↓
TreasuryWithPolicy (on-chain)
- validates identity
- enforces policy invariants
- executes or reverts
        ↓
USDC (native Arc settlement)
```

## Key Components

### 1. Agent Registry (On-Chain Identity)

**Purpose:** Bind an agent address to an owner and activation state.

**Properties:**
* Explicit agent registration
* Owner-controlled revocation/reactivation
* No implicit trust in msg.sender
* Immutable audit trail via events

**Security Insight:** Even if an agent key is compromised, the owner can immediately revoke it on-chain.

### 2. Treasury with Policy Enforcement

**Purpose:** Act as a firewall between AI intent and real funds.

**Enforced Invariants (examples):**
* Per-transaction spending limit
* Daily spending cap
* Cooldown between payments
* Recipient allowlist
* Replay protection via nonces
* Global pause for emergencies

**Critical Property:** The treasury does not care how the intent was generated—only whether it satisfies policy.

### 3. Gemini AI Agent (Off-Chain Reasoning)

**Role:** The agent performs bounded reasoning, not execution.

**What the agent does:**
* Interprets user or system requests
* Evaluates them against known policy
* Adjusts amounts if needed
* Outputs a structured `PaymentIntent`

**What the agent does NOT do:**
* Hold funds
* Sign transactions
* Bypass policy
* Retry execution on failure

This preserves a strict trust boundary.

### 4. Backend Executor

**Purpose:** Bridge AI output to on-chain execution.

**Responsibilities:**
* Accept structured intent from Gemini
* Call `validateIntent()` (optional pre-check)
* Submit `executePayment()` transaction
* Log transaction hash and result

The backend is stateless and replaceable.

## Why This Architecture Is Trustless

| Layer | Trust Model |
|-------|-------------|
| Gemini AI | Untrusted proposer |
| Backend | Untrusted relayer |
| Smart Contracts | Fully trusted enforcement |
| Arc + USDC | Deterministic settlement |

Even if:
* the AI hallucinates
* the backend is malicious
* requests are spammed

➡️ **Funds remain safe.**

## Why Arc + Native USDC

* USDC is both gas and value
* No volatile token exposure
* Predictable fees
* Clean accounting for agents
* Ideal for agentic commerce

The treasury enforces policy directly on the settlement asset, not a wrapper.