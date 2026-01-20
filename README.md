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

## Demo Overview

This demo intentionally uses **small policy limits ($1 per transaction)** to make enforcement behavior immediately visible on testnet without exhausting faucet-limited USDC.

The demo showcases five scenarios executed against the same on-chain Treasury:

1. **Valid Payment** — Agent proposes a compliant payment → executed on-chain  
2. **AI Refusal** — Agent refuses to propose an over-limit payment  
3. **Cooldown Enforcement** — Treasury rejects rapid repeated payments  
4. **Unauthorized Recipient** — Treasury blocks payments to non-allowlisted addresses  
5. **Replay Protection** — Treasury rejects reused nonces deterministically  

These scenarios demonstrate **defense in depth**:
- AI performs bounded reasoning  
- Smart contracts remain the final authority  

**Run the demo:**
```bash
cd agent
npm install
npm run demo
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

**Enforced Invariants:**
- Per-transaction spending limit  
- Daily spending cap  
- Recipient allowlist  
- Replay protection via nonces  
- Global pause for emergencies  
- Cooldown between payments (rate-limits agent execution to reduce blast radius)

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
- Optionally call `validateIntent()` for pre-checks  
- Submit `executePayment()` transaction  
- Log transaction hash and result  

The backend is stateless and replaceable.

---

## Why This Architecture Is Trustless

| Layer | Trust Model |
|-------|-------------|
| Gemini AI | Untrusted proposer |
| Backend | Untrusted relayer |
| Smart Contracts | Fully trusted enforcement |
| Arc + USDC | Deterministic settlement |

Even if:
- the AI hallucinates  
- the backend is malicious  
- requests are spammed  

➡️ **Funds remain safe.**

### Security Guarantees

Even with high policy limits, the system maintains bounded risk:
- **Per-agent isolation:** One compromised agent can't drain another's budget  
- **Worst-case loss:** Limited to (perTxLimit × transactions per day)  
- **Immediate revocation:** Owner can pause or revoke agent instantly  
- **Audit trail:** All payments recorded on-chain for forensic analysis  
- **No AI custody:** Agents never hold funds, only propose intents  

This architecture enables autonomous operations while maintaining deterministic safety bounds.

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
- **Explorer:** [View on Arcscan](https://testnet.arcscan.app/tx/0x735a3abf24866c376d8150c7698d001d3f36183ee991c77633cf08c24c818185?tab=index)

This transaction demonstrates that:
- AI proposed the payment  
- Smart contracts enforced all limits  
- Settlement occurred directly in Arc USDC  

---

## Configurable Policy Limits (Production)

The $1 per-transaction limit used in the demo is intentionally conservative for clarity and testnet constraints.

In production, organizations configure policy thresholds based on risk tolerance—**without changing contract logic**.

| Organization Type | Per-Tx Limit | Daily Limit | Example Use Case |
|-------------------|-------------|-------------|------------------|
| Small Business | $100 | $500 | API calls, stock assets |
| Mid-Size Company | $1,000 | $10,000 | Data subscriptions |
| Enterprise | $10,000+ | $100,000+ | Real-time research feeds |

Only configuration values change via `updatePolicy()`.  
The enforcement engine remains identical.

**Example:**
```solidity
treasury.updatePolicy(
    100_000_000_000,  // $100,000 per-tx
    500_000_000_000,  // $500,000 daily
    1 hours           // cooldown
);
```

---

## Service Integration Patterns

### Pattern 1: Direct API Integration
```
Agent queries API pricing endpoint
API returns: { "service": "weather", "cost": 0.50 }
Agent proposes payment intent
Treasury validates and executes
```

### Pattern 2: Invoice-Based
```
Service emails invoice
Frontend OCR extracts amount
Human reviews and approves
Agent executes payment
```

### Pattern 3: Subscription Management
```
Monthly subscription: $49
Agent auto-pays on due date
Treasury enforces limits
Human monitors via dashboard
```

---

## Why This Architecture Scales

- ✅ **Configurable limits** — Adjust risk tolerance without code changes  
- ✅ **Multi-agent support** — Each agent tracked independently  
- ✅ **Composable policies** — Per-tx + daily + cooldown + allowlist  
- ✅ **Deterministic enforcement** — No AI can bypass on-chain rules  
- ✅ **Audit trail** — All payments recorded on-chain  
- ✅ **Emergency controls** — Pause mechanism for incidents  

The system is production-ready; deployment specifics depend on organizational requirements.

---

## Future Extensions

Future iterations may include:
- Frontend dashboards for policy configuration  
- Invoice/receipt parsing to pre-fill intents  
- Approval queues for over-limit payments  
- Reputation-based dynamic policy adjustments  

These features extend the system but do not alter its core security model.

---

## Quick Start

### Prerequisites
- Foundry installed  
- Node.js v18+  
- Arc Sepolia testnet access  

### Installation

```bash
git clone git@github.com:tr-Kalyan/policy-governed-agent.git
cd policy-governed-agent

# Install contract dependencies
forge install

# Install agent dependencies
cd agent
npm install
```

### Run Demo

```bash
cd agent
npm run demo
```

---

## Testing

```bash
# Smart contract tests
forge test -vvv

# Agent integration tests
cd agent
npm test
```

---

## Built With

- [Solidity ^0.8.26](https://soliditylang.org/)  
- [Foundry](https://book.getfoundry.sh/)  
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)  
- [Arc Network](https://arc.gateway.fm/)  
- [Circle USDC](https://www.circle.com/usdc)  
- [Google Gemini](https://ai.google.dev/)  

---

## Hackathon Tracks

This project competes in:
- 🏆 **Best Trustless AI Agent** (Circle + Arc)  

---

## License

MIT

---

## Acknowledgments

Built at [@lablabai](https://lablab.ai)'s Agentic Commerce on Arc Hackathon

Powered by:
- [@BuildOnCircle](https://twitter.com/BuildOnCircle)  
- [@GoogleAI](https://twitter.com/GoogleAI)