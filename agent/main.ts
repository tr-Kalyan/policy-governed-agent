import { getPolicy, proposePayment, executePayment, ensureCooldownElapsed } from "./agent";
import "dotenv/config";

const AGENT_ADDRESS = process.env.AGENT_ADDRESS!;
const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS!;

async function main() {
  console.log("🧪 Running single test\n");

  const policy = await getPolicy(AGENT_ADDRESS);

  console.log("📋 Live policy:", {
    perTx: `$${Number(policy.perTx) / 1e6}`,
    daily: `$${Number(policy.daily) / 1e6}`,
    cooldown: `${policy.cooldown}s`,
    spent: `$${Number(policy.spent) / 1e6}`
  });

  
  await ensureCooldownElapsed(AGENT_ADDRESS, BigInt(policy.cooldown));

  const intent = await proposePayment({
    request: `Pay 0.1 USDC to API provider at ${RECIPIENT_ADDRESS}`,
    agentAddress: AGENT_ADDRESS,
    policy: {
      perTxLimit: policy.perTx,
      dailyRemaining: (BigInt(policy.daily) - BigInt(policy.spent)).toString(),
      cooldownSeconds: policy.cooldown,
      allowedRecipients: [RECIPIENT_ADDRESS]
    }
  });

  console.log("\n💡 Proposed intent:", intent);

  const txHash = await executePayment(intent);
  console.log(`\n✅ Payment executed!`);
  console.log(`📤 Tx hash: ${txHash}`);
}

main().catch(console.error);
