/**
 * demo.ts
 *
 * PGAP — Policy-Governed Agent Payments
 *
 * Purpose:
 * Scripted, narrative demo showing how AI agents propose payments
 * and how on-chain policy deterministically enforces safety.
 */

import "dotenv/config";
import {
  getPolicy,
  proposePayment,
  executePayment,
  ensureCooldownElapsed,
} from "./agent";

// ================== CONFIG ==================

const AGENT_A = process.env.AGENT_A_ADDRESS!;
const AGENT_B = process.env.AGENT_B_ADDRESS!;
const AGENT_C = process.env.AGENT_C_ADDRESS!;
const ALLOWED_RECIPIENT = process.env.RECIPIENT_ADDRESS!;
const TREASURY = process.env.TREASURY_ADDRESS!;
const ATTACKER = "0x000000000000000000000000000000000000dEaD";

if (!AGENT_A || !AGENT_B || !AGENT_C || !ALLOWED_RECIPIENT || !TREASURY) {
  throw new Error("Missing required demo env vars");
}

// ================== UTILITIES ==================

function banner(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function section(title: string) {
  console.log("\n▶ " + title);
}

async function printPolicy(agent: string) {
  const policy = await getPolicy(agent);
  console.log("Policy:", {
    perTx: Number(policy.perTx) / 1e6,
    daily: Number(policy.daily) / 1e6,
    cooldown: policy.cooldown,
    spent: Number(policy.spent) / 1e6,
  });
}

// ================== SCENARIO RUNNER ==================

async function runScenario(name: string, fn: () => Promise<void>) {
  section(name);
  try {
    await fn();
    console.log("✅ Scenario completed");
  } catch (err: any) {
    console.log("❌ Scenario reverted");
    console.log("Reason:", err?.shortMessage || err?.message || err);
  }
}

// ================== MAIN ==================

async function main() {
  banner("PGAP DEMO — Policy-Governed Agent Payments");

  console.log("Treasury:", TREASURY);
  console.log("Agents:", {
    AgentA: AGENT_A,
    AgentB: AGENT_B,
    AgentC: AGENT_C,
  });

  section("Initial Policy State");
  await printPolicy(AGENT_A);

  // ================== SCENARIO 1: Valid Payment ==================

  await runScenario("Scenario 1 — Valid Payment (Agent A)", async () => {
    const agent = AGENT_A;
    const policy = await getPolicy(agent);

    // Ensure cooldown elapsed if agent was used before
    await ensureCooldownElapsed(agent, BigInt(policy.cooldown));

    const intent = await proposePayment({
      request: `Pay 1 USDC to ${ALLOWED_RECIPIENT} for API access`,
      agentAddress: agent,
      policy: {
        perTxLimit: policy.perTx,
        dailyRemaining: (BigInt(policy.daily) - BigInt(policy.spent)).toString(),
        cooldownSeconds: policy.cooldown,
        allowedRecipients: [ALLOWED_RECIPIENT],
      },
    });

    console.log("Proposed intent:", {
      amount: Number(intent.amount) / 1e6,
      nonce: intent.nonce,
      reasoning: intent.reasoning
    });

    const txHash = await executePayment(intent);
    console.log("✅ Payment executed");
    console.log("Tx hash:", txHash);
  });

  // ================== SCENARIO 2: AI Refuses Over-Limit ==================

  await runScenario("Scenario 2 — AI Refuses Over-Limit Payment (Agent B)", async () => {
    const agent = AGENT_B;
    const policy = await getPolicy(agent);

    try {
      const intent = await proposePayment({
        request: "Pay 2 USDC for premium API access",
        agentAddress: agent,
        policy: {
          perTxLimit: policy.perTx,
          dailyRemaining: (BigInt(policy.daily) - BigInt(policy.spent)).toString(),
          cooldownSeconds: policy.cooldown,
          allowedRecipients: [ALLOWED_RECIPIENT],
        },
      });

      // If we got here, AI didn't refuse - that's a problem
      console.log("⚠️  AI proposed:", intent);
      throw new Error("AI should have refused but proposed a payment");
    } catch (err: any) {
      // Expected - AI should refuse
      if (err.message.includes("Agent rejected") || err.message.includes("did not propose")) {
        console.log("✅ AI correctly refused invalid request");
        console.log("Reason:", err.message);
      } else {
        throw err;
      }
    }
  });

  // ================== SCENARIO 3: Cooldown Enforcement ==================

  await runScenario("Scenario 3 — Cooldown Enforcement (Agent A)", async () => {
    const agent = AGENT_A;
    const policy = await getPolicy(agent);

    // Don't wait for cooldown - we want to trigger the error
    const intent = await proposePayment({
      request: `Pay 1 USDC to ${ALLOWED_RECIPIENT} immediately`,
      agentAddress: agent,
      policy: {
        perTxLimit: policy.perTx,
        dailyRemaining: (BigInt(policy.daily) - BigInt(policy.spent)).toString(),
        cooldownSeconds: policy.cooldown,
        allowedRecipients: [ALLOWED_RECIPIENT],
      },
    });

    console.log("Proposed intent (will be rejected on-chain):", {
      amount: Number(intent.amount) / 1e6,
    });

    try {
      await executePayment(intent);
      throw new Error("Cooldown was bypassed - this should not happen!");
    } catch (err: any) {
      if (err.data === "0x9e494994" || err.message.includes("Cooldown")) {
        console.log("✅ Treasury enforced cooldown on-chain");
        console.log("↳ AI proposed, but contract rejected (as designed)");
      } else {
        throw err;
      }
    }
  });

  // ================== SCENARIO 4: Unauthorized Recipient ==================

  await runScenario("Scenario 4 — Unauthorized Recipient (Agent B)", async () => {
    const agent = AGENT_B;
    const policy = await getPolicy(agent);

    // Tell AI the attacker is allowed (lie to the AI)
    const intent = await proposePayment({
      request: `Pay 1 USDC to ${ATTACKER}`,
      agentAddress: agent,
      policy: {
        perTxLimit: policy.perTx,
        dailyRemaining: (BigInt(policy.daily) - BigInt(policy.spent)).toString(),
        cooldownSeconds: policy.cooldown,
        allowedRecipients: [ATTACKER], // Lie to AI
      },
    });

    console.log("AI was told attacker is allowed, proposed payment to:", intent.recipient);

    try {
      await executePayment(intent);
      throw new Error("Unauthorized recipient was paid - treasury failed!");
    } catch (err: any) {
      if (err.data === "0x4ccc1eec" || err.message.includes("Recipient")) {
        console.log("✅ Treasury blocked unauthorized recipient");
        console.log("↳ AI was misled, but contract enforced truth");
      } else {
        throw err;
      }
    }
  });

  // ================== SCENARIO 5: Nonce Replay Attack ==================

  await runScenario("Scenario 5 — Nonce Replay Attack (Agent C)", async () => {
    const agent = AGENT_C;
    const policy = await getPolicy(agent);

    const intent = await proposePayment({
      request: `Pay 1 USDC to ${ALLOWED_RECIPIENT}`,
      agentAddress: agent,
      policy: {
        perTxLimit: policy.perTx,
        dailyRemaining: (BigInt(policy.daily) - BigInt(policy.spent)).toString(),
        cooldownSeconds: policy.cooldown,
        allowedRecipients: [ALLOWED_RECIPIENT],
      },
    });

    console.log("First payment with nonce:", intent.nonce);

    // Execute first time (should succeed)
    const txHash = await executePayment(intent);
    console.log("✅ First payment succeeded:", txHash);

    // Try to replay the same intent
    console.log("Attempting replay with same nonce...");

    try {
      await executePayment(intent);
      throw new Error("Replay attack succeeded - this should not happen!");
    } catch (err: any) {
      if (err.data === "0x1fb09b80" || err.message.includes("Nonce")) {
        console.log("✅ Nonce replay blocked on-chain");
        console.log("↳ Same intent cannot execute twice");
      } else {
        throw err;
      }
    }
  });

  banner("DEMO COMPLETE");
  console.log("\n🎯 Key Takeaways:");
  console.log("1. AI proposes payments based on context");
  console.log("2. Smart contracts enforce all rules deterministically");
  console.log("3. Even if AI misbehaves or is misled, funds stay safe");
  console.log("4. Policy = per-tx limits + daily limits + cooldowns + allowlists + nonces");
  console.log("\n✅ Trust-minimized agentic commerce achieved\n");
}

main().catch((err) => {
  console.error("\n❌ Demo failed");
  console.error(err);
  process.exit(1);
});