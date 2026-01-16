// import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import { PaymentIntentSchema, AgentInput } from "./schema";
import { buildPrompt } from "./prompt";
import "dotenv/config";

export async function proposePayment(input: AgentInput) {
    const genAI = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY!,
        apiVersion: 'v1'
    });
    const modelName = "gemini-2.5-flash-lite"; // Use 2.0 or 2.5 for stability

    const result = await genAI.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
        config: {
            // We use 'as any' to tell TypeScript to stay out of the way.
            // This allows us to send the snake_case name the API actually requires.
            ["response_mime_type" as any]: "application/json" 
        } as any
    });

    // FIX: Access .text() directly on the result
    const text = result?.text;

    // Check if the response is actually there
    if (!text) {
        throw new Error("Gemini returned an empty response. This might be due to safety filters.");
    }

    let parsed;
    try {
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanJson);
    } catch (e) {
        throw new Error(`Gemini returned invalid JSON: ${text}`);
    }

    if (parsed.reject) {
        throw new Error(`Agent rejected request: ${parsed.reason}`);
    }

    return PaymentIntentSchema.parse(parsed);
}