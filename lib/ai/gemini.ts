import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export class GeminiStructuredError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly rawResponse?: string
  ) {
    super(message);
    this.name = "GeminiStructuredError";
  }
}

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable in .env.local.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

/**
 * Executes a single Gemini call with strict timeout.
 */
async function executeSingleCall(
  ai: GoogleGenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  responseSchema?: unknown,
  timeoutMs = 8000
): Promise<string> {
  let timer: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Gemini API call timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  const config: Record<string, unknown> = {
    systemInstruction: systemPrompt,
    responseMimeType: "application/json",
    temperature: 0.1,
  };

  if (responseSchema) {
    config.responseSchema = responseSchema;
  }

  const apiPromise = ai.models
    .generateContent({
      model,
      contents: userPrompt,
      config,
    })
    .then((res) => res.text ?? "");

  try {
    return await Promise.race([apiPromise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Executes Gemini call with fallback model handling on 503 high-demand or transient spikes.
 */
async function callGeminiWithTimeout(
  ai: GoogleGenAI,
  primaryModel: string,
  systemPrompt: string,
  userPrompt: string,
  responseSchema?: unknown,
  timeoutMs = 15000
): Promise<string> {
  const modelsToTry = [
    primaryModel,
    primaryModel === "gemini-3.5-flash" ? "gemini-3.5-flash-lite" : "gemini-3.5-flash",
  ];

  let lastError: unknown;

  for (const m of modelsToTry) {
    try {
      return await executeSingleCall(ai, m, systemPrompt, userPrompt, responseSchema, timeoutMs);
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("high demand") ||
        msg.includes("RESOURCE_EXHAUSTED")
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

/**
 * Generates a structured JSON response from Gemini, validated against a Zod schema.
 * Automatically derives responseSchema, sets temperature to 0.1 and 15s timeout,
 * and retries ONCE with feedback if JSON parsing or schema validation fails.
 */
export async function generateStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  zodSchema: z.ZodType<T>
): Promise<T> {
  const ai = getAiClient();
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  let responseSchema: unknown = undefined;
  try {
    if (typeof (z as unknown as { toJSONSchema?: (s: unknown) => unknown }).toJSONSchema === "function") {
      responseSchema = (z as unknown as { toJSONSchema: (s: unknown) => unknown }).toJSONSchema(zodSchema);
    }
  } catch {
    responseSchema = undefined;
  }

  let lastRawText = "";
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const promptToSend =
      attempt === 1
        ? userPrompt
        : `${userPrompt}\n\n[PREVIOUS ATTEMPT FAILED SCHEMA VALIDATION]\nYour previous output failed validation with error:\n${
            lastError instanceof Error ? lastError.message : String(lastError)
          }\nRaw output was:\n${lastRawText}\n\nPlease correct the response and return ONLY valid JSON strictly conforming to the requested schema.`;

    try {
      lastRawText = await callGeminiWithTimeout(ai, model, systemPrompt, promptToSend, responseSchema, 8000);

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(lastRawText);
      } catch (jsonErr) {
        throw new Error(`Invalid JSON syntax received from Gemini: ${(jsonErr as Error).message}`);
      }

      const validated = zodSchema.safeParse(parsedJson);
      if (!validated.success) {
        const issues = validated.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        throw new Error(`Schema mismatch: ${issues}`);
      }

      return validated.data;
    } catch (err: unknown) {
      lastError = err;
      if (attempt === 2) {
        throw new GeminiStructuredError(
          `Failed to generate valid structured output from Gemini after retry: ${
            err instanceof Error ? err.message : String(err)
          }`,
          err,
          lastRawText
        );
      }
    }
  }

  throw new GeminiStructuredError("Unexpected termination of generateStructured loop.");
}
