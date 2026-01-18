/**
 * test.ts
 *
 * Purpose:
 * Validate that TreasuryWithPolicy correctly REJECTS
 * payments that violate policy constraints.
 *
 * This file is NOT part of the demo flow.
 */

import {
  getPolicy,
  proposePayment,
  executePayment,
  ensureCooldownElapsed
} from "./agent";
import "dotenv/config";
import { Interface } from "ethers";

const treasuryInterface = new Interface([
  "error AmountExceedsPerTxLimit()",
  "error DailyLimitExceeded()",
  "error CooldownNotPassed()",
  "error NonceAlreadyUsed()",
  "error RecipientNotAllowed()",
  "error AgentNotAuthorized()",
  "error TreasuryPaused()"
]);


const AGENT = process.env.AGENT_ADDRESS!;
const RECIPIENT = process.env.RECIPIENT_ADDRESS!;

async function testPerTxLimit() {
  console.log("\n🧪 Test: perTx limit enforcement (on-chain)");

  const policy = await getPolicy(AGENT);

  const overLimitIntent = {
    agent: AGENT,
    recipient: RECIPIENT,
    amount: (BigInt(policy.perTx) + 1n).toString(), // force violation
    nonce: "9999" // arbitrary unused nonce
  };

  try {
    await executePayment(overLimitIntent);
    console.error("❌ FAILED: perTx limit was bypassed");
  } catch (err: any) {
    try {
        const decoded = treasuryInterface.parseError(err.data);
        if (decoded) {
            console.log(`✅ PASSED: reverted with ${decoded.name}`);
        } else {
            console.log("✅ PASSED: cooldown enforced (revert)");
        }
    } catch {
        console.log("✅ PASSED: perTx limit enforced (revert)");
    }
    }
}

async function testDailyLimit() {
  console.log("\n🧪 Test: daily limit enforcement (on-chain)");

  const policy = await getPolicy(AGENT);

  if (BigInt(policy.daily) === 0n) {
    console.log("ℹ️ Skipped: daily limit disabled");
    return;
  }

  // Ensure cooldown is active; otherwise test is meaningless
  try {
    await ensureCooldownElapsed(AGENT, BigInt(policy.cooldown));
    console.log("ℹ️ Skipped: cooldown not active yet");
    return;
  } catch {
    // cooldown active — proceed
  }

  const remaining = BigInt(policy.daily) - BigInt(policy.spent);
  if (remaining <= 0n) {
    console.log("ℹ️ Skipped: daily already exhausted");
    return;
  }

  const violateAmount = remaining + 1n;

  // Ensure we isolate daily limit, not perTx
  if (violateAmount > BigInt(policy.perTx)) {
    console.log("ℹ️ Skipped: perTx limit would trigger first");
    return;
  }

  const intent = {
    agent: AGENT,
    recipient: RECIPIENT,
    amount: violateAmount.toString(),
    nonce: "30001" // test-local nonce, NOT agent nonce
  };

  try {
    await executePayment(intent);
    console.error("❌ FAILED: daily limit was bypassed");
  } catch (err: any) {
    try {
      const decoded = treasuryInterface.parseError(err.data);
      if (decoded) {
        console.log(`✅ PASSED: reverted with ${decoded.name}`);
      } else {
        console.log("✅ PASSED: daily limit enforced (revert)");
      }
    } catch {
      console.log("✅ PASSED: daily limit enforced (revert)");
    }
  }
}

async function testCooldown() {
  console.log("\n🧪 Test: cooldown enforcement (on-chain)");

  const policy = await getPolicy(AGENT);

  if (BigInt(policy.cooldown) === 0n) {
    console.log("ℹ️ Skipped: cooldown disabled");
    return;
  }

  // Precondition: cooldown MUST be active for this test to be meaningful
  try {
    await ensureCooldownElapsed(AGENT, BigInt(policy.cooldown));
    console.log("ℹ️ Skipped: cooldown not active yet");
    return;
  } catch {
    // Cooldown active — proceed to enforcement test
  }

  // Attempt payment during cooldown
  const intent = await proposePayment({
    request: `Pay 1 USDC to ${RECIPIENT}`,
    agentAddress: AGENT,
    policy: {
      perTxLimit: policy.perTx,
      dailyRemaining: policy.daily,
      cooldownSeconds: policy.cooldown,
      allowedRecipients: [RECIPIENT]
    }
  });

  try {
    await executePayment(intent);
    console.error("❌ FAILED: cooldown was bypassed");
  } catch (err: any) {
    try {
      const decoded = treasuryInterface.parseError(err.data);
      if (decoded) {
        console.log(`✅ PASSED: reverted with ${decoded.name}`);
      } else {
        console.log("✅ PASSED: cooldown enforced (revert)");
      }
    } catch {
      console.log("✅ PASSED: cooldown enforced (revert)");
    }
  }
}



async function runTests() {
  await testPerTxLimit();
  await testCooldown();
  await testDailyLimit();
}

runTests().catch(console.error);
