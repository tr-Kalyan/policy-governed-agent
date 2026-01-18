import { GoogleGenAI } from "@google/genai";
import { PaymentIntentSchema, AgentInput } from "./schema";
import { buildPrompt } from "./prompt";
import { ethers } from "ethers";
import "dotenv/config";

// ================== NONCE ==================
let nextNonce = 1n;

function getNextNonce(): string {
  return (nextNonce++).toString();
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
  const nonce = getNextNonce();

  const enrichedInput = {
    ...input,
    nonce
  };

  const genAI = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    apiVersion: "v1"
  });

  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: [{ role: "user", parts: [{ text: buildPrompt(enrichedInput) }] }],
    config: { ["response_mime_type" as any]: "application/json" } as any
  });

  const text = result?.text;
  if (!text) throw new Error("Empty Gemini response");

  const parsed = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
  if (parsed.reject) throw new Error(`Agent rejected: ${parsed.reason}`);

  return PaymentIntentSchema.parse(parsed);
}

export async function executePayment(intent: any) {
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
