import { Agent } from "node:http";
import {z} from "zod";

export const AgentInputSchema = z.object({
    request: z.string(),
    agentAddress:z.string(),
    nonce: z.number(),
    policy: z.object({
        perTxLimit: z.number(),
        dailyRemaining: z.number(),
        cooldownSeconds: z.number(),
        allowedRecipients: z.array(z.string())
    })
});

export const PaymentIntentSchema = z.object({
    agent:z.string(),
    recipient:z.string(),
    amount:z.number(),
    nonce:z.number(),
    reasoning:z.string()
});

export type AgentInput = z.infer<typeof AgentInputSchema>;
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;