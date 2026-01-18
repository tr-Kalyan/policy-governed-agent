
# Policy-Governed Agent Payments (PGAP)

## Overview

PGAP is a trust-minimized agentic payment system built on Arc using USDC. AI agents can propose payments based on context and policy, but never control funds. All enforcement happens on-chain, ensuring deterministic safety even if the agent misbehaves.

**Core principle:** AI proposes. Smart contracts enforce.

This architecture prevents rogue agents, hallucinated payments, and uncontrolled spending—key risks in agentic commerce systems.

---

## Problem Statement

As AI agents begin to autonomously purchase APIs, data, compute, or services, a critical risk emerges:

- Agents may overspend  
- Agents may hallucinate recipients or amounts  
- Off-chain safeguards can be bypassed  
- Humans lose deterministic control over funds  

Existing systems rely on off-chain trust or agent self-restraint, which does not scale safely.

---

## Design Goals

1. **Trust minimization** — AI never has custody or signing power  
2. **Deterministic enforcement** — all payment rules enforced on-chain  
3. **Composable agent logic** — any AI model can propose intents  
4. **Clear authority boundaries** — identity, policy, treasury separated  
5. **Auditability** — every payment is verifiable on Arc  

---

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

---

## Key Components

### 1. Agent Registry (On-Chain Identity)

**Purpose:** Bind an agent address to an owner and activation state.

**Properties:**
- Explicit agent registration  
- Owner-controlled revocation/reactivation  
- No implicit trust in `msg.sender`  
- Immutable audit trail via events  

**Security Insight:** Even if an agent key is compromised, the owner can immediately revoke it on-chain.

---

### 2. Treasury with Policy Enforcement

**Purpose:** Act as a firewall between AI intent and real funds.

**Enforced Invariants (examples):**
- Per-transaction spending limit  
- Daily spending cap  
- Cooldown between payments  
- Recipient allowlist  
- Replay protection via nonces  
- Global pause for emergencies  

**Critical Property:** The treasury does not care how the intent was generated—only whether it satisfies policy.

---

### 3. Gemini AI Agent (Off-Chain Reasoning)

**Role:** The agent performs bounded reasoning, not execution.

**What the agent does:**
- Interprets user or system requests  
- Evaluates them against known policy  
- Adjusts amounts if needed  
- Outputs a structured `PaymentIntent`  

**What the agent does NOT do:**
- Hold funds  
- Sign transactions  
- Bypass policy  
- Retry execution on failure  

This preserves a strict trust boundary.

---

### 4. Backend Executor

**Purpose:** Bridge AI output to on-chain execution.

**Responsibilities:**
- Accept structured intent from Gemini  
- Optionally call `validateIntent()`  
- Submit `executePayment()` transaction  
- Log transaction hash and result  

The backend is stateless and replaceable.

---

## Why This Architecture Is Trustless

| Layer | Trust Model |
|------|-------------|
| Gemini AI | Untrusted proposer |
| Backend | Untrusted relayer |
| Smart Contracts | Fully trusted enforcement |
| Arc + USDC | Deterministic settlement |

Even if:
- the AI hallucinates  
- the backend is malicious  
- requests are spammed  

➡️ **Funds remain safe.**

---

## Why Arc + Native USDC

- USDC is both gas and value  
- No volatile token exposure  
- Predictable fees  
- Clean accounting for agent-driven payments  
- Ideal for agentic commerce  

The treasury enforces policy directly on the settlement asset, not a wrapper.

---

## Deployment Variants

PGAP was deployed in two configurations during development for clear and intentional reasons.

### 1. Arc Testnet USDC Deployment (Primary)

This deployment represents the intended production architecture using native Arc USDC.

**Contracts:**
- AgentRegistry: `0xa2225ce1F9e764bF11a57d3E8dea0492487562Ea`
- TreasuryWithPolicy: `0x9fB95CE21352d7FAB5A8A79aEB1E30B76F11B034`

**Properties:**
- Uses native Arc Testnet USDC  
- Demonstrates real agentic commerce flow  
- No mock tokens or wrappers  

A successful on-chain payment was executed from this treasury using Arc Testnet USDC, proving end-to-end policy-governed execution on the native settlement asset.

---

### 2. MockUSDC Deployment (Testing)

This deployment exists solely to enable exhaustive testing without faucet constraints.

**Contracts:**
- AgentRegistry: `0x853b31b0541059c72a76deeB23eA4414AdB42B58`
- TreasuryWithPolicy: `0x2c90738D80C19dDe2094B5E58b4dC06202fa1243`
- MockUSDC: `0xBa9c42df8e2b800902A5191971634825F958DA04`

**Rationale:**
- Arc Testnet USDC is faucet-limited  
- Policy logic requires stress testing (cooldowns, caps, nonce replay)  
- Treasury logic remains identical; only the token differs  

This separation ensures testing rigor without weakening the real deployment.

---


## Verified Arc USDC Transaction

PGAP successfully executed a live payment using **native Arc Testnet USDC**, fully governed by on-chain policy.

- **Network:** Arc Testnet  
- **Asset:** Native USDC (gas + value)  
- **Treasury:** `0x9fB95CE21352d7FAB5A8A79aEB1E30B76F11B034`  
- **Relayer:** `0x8eCaDD0bA353048e9c92A5a2be341ce902250C41`  
- **Amount:** 1 USDC  
- **Transaction Hash:**  
  `0x735a3abf24866c376d8150c7698d001d3f36183ee991c77633cf08c24c818185`

This transaction demonstrates that:
- AI proposed the payment
- Smart contracts enforced all limits
- Settlement occurred directly in Arc USDC


## Note on USDC Availability

Arc Testnet USDC is currently faucet-limited.  
A request has been submitted to Circle for additional testnet USDC to enable higher-volume and multi-payment demonstrations.

---

## Design Intent

Maintaining both deployments is a deliberate engineering decision:

- Native USDC deployment proves correctness and settlement integrity  
- MockUSDC deployment proves safety under adversarial conditions  

This mirrors real-world protocol development with production contracts and isolated test environments.

