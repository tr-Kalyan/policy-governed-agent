import "dotenv/config";
import { proposePayment } from "./agent";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY");
}

async function main() {
  const intent = await proposePayment({
    // Adding specific data that the model can map to your schema
    request: "Pay WeatherCorp (0xabc0000000000000000000000000000000000000) 50 tokens for today's data usage.",
    agentAddress: "0x1234567890abcdef",
    nonce: 1,
    policy: {
      perTxLimit: 100,
      dailyRemaining: 300,
      cooldownSeconds: 3600,
      allowedRecipients: ["0xabc0000000000000000000000000000000000000"]
    }
});

  console.log(intent);
}

main();
