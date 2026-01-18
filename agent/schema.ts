import { z } from "zod";

export const AgentInputSchema = z.object({
  request: z.string(),
  agentAddress: z.string(),
  policy: z.object({
    perTxLimit: z.string(),
    dailyRemaining: z.string(),
    cooldownSeconds: z.string(),
    allowedRecipients: z.array(z.string())
  })
});

export const PaymentIntentSchema = z.object({
  agent: z.string(),
  recipient: z.string(),
  amount: z.string().regex(/^\d+$/, "amount must be uint256 string"),
  nonce: z.string().regex(/^\d+$/, "nonce must be uint256 string"),
  reasoning: z.string()
});

export type AgentInput = z.infer<typeof AgentInputSchema>;
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;
