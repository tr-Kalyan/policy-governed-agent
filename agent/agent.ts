import { GoogleGenAI } from "@google/genai";
import { PaymentIntentSchema, AgentInput, proposePaymentTool, PaymentIntent } from "./schema";
import { buildPrompt } from "./prompt";
import { ethers } from "ethers";
import "dotenv/config";



export type ExecutionIntent = {
  agent: string;
  recipient: string;
  amount: string;
  nonce: string;
};


// ================== NONCE ==================
// Nonce is monotonically increasing per agent.
// Off-chain nonce is used only for sequencing.
// On-chain contract enforces replay protection.
const agentNonces = new Map<string, bigint>();

function getNextNonce(agent: string): string {
  const current = agentNonces.get(agent) ?? BigInt(Date.now());
  const next = current + 1n;
  agentNonces.set(agent, next);
  return next.toString();
}

// ================== ENV ==================
const ARC_RPC = process.env.ARC_TESTNET_RPC!;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS!;
const RELAYER_PK = process.env.RELAYER_PRIVATE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

if (!ARC_RPC || !TREASURY_ADDRESS || !RELAYER_PK || !GEMINI_API_KEY) {
  throw new Error("Missing required env vars");
}

if (!RELAYER_PK.startsWith("0x") || RELAYER_PK.length !== 66) {
  throw new Error("RELAYER_PRIVATE_KEY must be 32-byte hex with 0x prefix");
}

// ================== ETHERS ==================
const provider = new ethers.JsonRpcProvider(ARC_RPC);
const signer = new ethers.Wallet(RELAYER_PK, provider);

// ================== ABI ==================
const TreasuryABI = [
  "function executePayment((address agent,address recipient,uint256 amount,uint256 nonce))",
  "function getPolicyLimits() view returns (uint256,uint256,uint256)",
  "function getAgentSpendingStatus(address) view returns (uint256,uint256)",
  "function lastPaymentTime(address) view returns (uint256)"
];

// ================== COOLDOWN PREFLIGHT ==================
export async function ensureCooldownElapsed(agent: string, cooldown: bigint) {
  if (cooldown === 0n) return;

  const treasury = new ethers.Contract(TREASURY_ADDRESS, TreasuryABI, provider);
  const last: bigint = await treasury.lastPaymentTime(agent);

  if (last === 0n) return;

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < last + cooldown) {
    const wait = Number(last + cooldown - now);
    throw new Error(`Cooldown active. Wait ${wait}s before next payment.`);
  }
}

// ================== EXPORTS ==================

export async function getPolicy(agentAddress: string) {
  const treasury = new ethers.Contract(TREASURY_ADDRESS, TreasuryABI, provider);
  const [perTx, daily, cooldown] = await treasury.getPolicyLimits();
  const [spent] = await treasury.getAgentSpendingStatus(agentAddress);

  return {
    perTx: perTx.toString(),
    daily: daily.toString(),
    cooldown: cooldown.toString(),
    spent: spent.toString()
  };
}

export async function proposePayment(input: AgentInput) {
  const nonce = getNextNonce(input.agentAddress);

  const enrichedInput = {
    ...input,
    nonce
  };

  const genAI = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    apiVersion: "v1beta"
  });

  // 1. Try to force structured output via config first (Best for Gemini 3)
  const result = await genAI.models.generateContent({
    model: "gemini-3-flash-preview", 
    contents: [{ role: "user", parts: [{ text: buildPrompt(enrichedInput) }] }],
    tools: [{ functionDeclarations: [proposePaymentTool] }],
    // TOOL CONFIG IS KEY: Force the model to use the tool if it can
    toolConfig: {
      functionCallingConfig: {
        mode: "ANY" // Forces the model to call a function
      }
    }
  } as any);

  // 2. The Extraction Logic: Handle both Tool Calls AND JSON Text
  const candidate = result.candidates?.[0];
  const functionCall = candidate?.content?.parts?.[0]?.functionCall;
  const textResponse = candidate?.content?.parts?.[0]?.text;

  // CASE A: It worked as a Tool Call (Ideal)
  if (functionCall && functionCall.name === "propose_payment") {
    console.log("✅ Gemini 3 used Function Calling");
    return PaymentIntentSchema.parse(functionCall.args);
  }

  // CASE B: It returned JSON text instead (Fallback)
  if (textResponse) {
    console.warn("⚠️ Gemini 3 returned text. Attempting JSON parse...");
    try {
      // Clean up markdown code blocks if present
      const cleanJson = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      
      // Map the parsed JSON to your schema if needed, or just validate
      // (Assuming the text output matches your schema structure)
      return PaymentIntentSchema.parse(parsed);
    } catch (e) {
      console.error("Failed to parse JSON text:", textResponse);
    }
  }
  throw new Error("Agent did not propose a valid payment intent (No tool call or valid JSON)");
}

export async function executePayment(intent: ExecutionIntent) {
  const treasury = new ethers.Contract(TREASURY_ADDRESS, TreasuryABI, signer);

  const tx = await treasury.executePayment({
    agent: intent.agent,
    recipient: intent.recipient,
    amount: BigInt(intent.amount),
    nonce: BigInt(intent.nonce)
  });

  await tx.wait();
  return tx.hash;
}

export { TREASURY_ADDRESS, provider };
