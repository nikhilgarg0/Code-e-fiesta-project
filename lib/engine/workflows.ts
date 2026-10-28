import { z } from "zod";
import { executeThroughProxy } from "@/lib/integrations/proxy";
import { fetchCompanyEnrichment } from "@/lib/integrations/enrichment";
import { createOrUpdateCrmContact } from "@/lib/integrations/crm";
import { sendEmailFollowup } from "@/lib/integrations/email";

// ==========================================
// Step Configuration Types
// ==========================================

export interface StepConfig {
  /** Field name remapping (e.g., { "employees": "staff_count", "full_name": "name" }) */
  fieldMapping?: Record<string, string>;
  /** Custom endpoint override (e.g., switch to fallback "/api/mock/enrichment-v2") */
  endpoint?: string;
  /** Maximum retry attempts on transient network or rate-limit failures */
  maxRetries?: number;
  /** Backoff delay in milliseconds before retrying */
  backoffMs?: number;
  /** Type coercion rules (e.g., { "employees": "number" }) */
  coerceRules?: Record<string, "number" | "string" | "boolean">;
  /** Whether this step should be skipped by an applied fix */
  skip?: boolean;
}

export interface StepExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  request: { url?: string; method: string; body?: unknown };
  response?: { status: number; headers: Record<string, string>; body?: unknown };
  errorMessage?: string;
  errorCode?: string;
}

export interface StepDefinition<TInput = any, TOutput = any> {
  name: string;
  expectedInputSchema: z.ZodType<TInput>;
  expectedOutputSchema: z.ZodType<TOutput>;
  defaultConfig: StepConfig;
  inputResolver?: (context: {
    inputPayload: Record<string, unknown>;
    stepOutputs: Record<string, unknown>;
  }) => Record<string, unknown>;
  handler: (input: TInput, config: StepConfig) => Promise<StepExecutionResult>;
}

// ==========================================
// Helper Utilities for Step Handlers
// ==========================================

function getBaseUrl(): string {
  if (process.env.PORT) {
    return `http://localhost:${process.env.PORT}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("3000")) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  return "http://localhost:3001";
}



export function resolveUrl(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const base = getBaseUrl().replace(/\/$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

/**
 * Transforms an object based on fieldMapping and coerceRules.
 * If fieldMapping has { "employees": "staff_count" }, it copies raw["staff_count"] to result["employees"].
 */
export function applyDataTransforms(
  raw: Record<string, unknown>,
  config?: StepConfig
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...raw };

  // 1. Field Mapping: targetKey -> sourceKey
  if (config?.fieldMapping) {
    for (const [targetKey, sourceKey] of Object.entries(config.fieldMapping)) {
      if (raw[sourceKey] !== undefined) {
        result[targetKey] = raw[sourceKey];
      }
    }
  }

  // 2. Type Coercion: fieldKey -> targetType
  if (config?.coerceRules) {
    for (const [fieldKey, targetType] of Object.entries(config.coerceRules)) {
      const val = result[fieldKey];
      if (val !== undefined && val !== null) {
        if (targetType === "number") {
          if (typeof val === "string") {
            const parsedNumber = Number.parseFloat(val.replace(/[^\d.-]/g, ""));
            if (!Number.isNaN(parsedNumber)) {
              result[fieldKey] = parsedNumber;
            }
          } else if (typeof val === "number") {
            result[fieldKey] = val;
          }
        } else if (targetType === "string") {
          result[fieldKey] = String(val);
        } else if (targetType === "boolean") {
          result[fieldKey] = Boolean(val);
        }
      }
    }
  }

  return result;
}

/**
 * Executes an HTTP fetch with a 5-second timeout and captures the raw request and response.
 */
async function executeHttpCall(
  url: string,
  method: string,
  payload: unknown,
  config?: StepConfig
): Promise<{
  request: { url: string; method: string; body: unknown };
  response?: { status: number; headers: Record<string, string>; body: unknown };
  error?: { message: string; code: string };
}> {
  const requestInfo = { url, method, body: payload };
  const maxRetries = config?.maxRetries ?? 0;
  const backoffMs = config?.backoffMs ?? 1000;

  let attempt = 0;
  while (true) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const headers = Object.fromEntries(res.headers.entries());
      const rawText = await res.text();
      let jsonBody: unknown;
      try {
        jsonBody = JSON.parse(rawText);
      } catch {
        jsonBody = rawText;
      }

      const responseInfo = {
        status: res.status,
        headers,
        body: jsonBody,
      };

      if (!res.ok) {
        // If retries are explicitly allowed in the config and failure is retriable (429 or 5xx)
        if (attempt < maxRetries && (res.status === 429 || res.status >= 500)) {
          attempt++;
          const retryAfter = res.headers.get("retry-after");
          const rawDelay = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : backoffMs * attempt;
          const timeScale = Number.parseFloat(process.env.DEMO_TIME_SCALE || "0.1") || 0.1;
          const delay = Math.max(10, Math.round(rawDelay * timeScale));
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        const bodyObj = (jsonBody && typeof jsonBody === "object") ? (jsonBody as Record<string, unknown>) : {};
        const code = (bodyObj.errorCode as string) || `HTTP_${res.status}`;
        const message = (bodyObj.message as string) || (bodyObj.error as string) || `Request failed with status ${res.status}`;

        return {
          request: requestInfo,
          response: responseInfo,
          error: { message, code },
        };
      }

      return { request: requestInfo, response: responseInfo };
    } catch (err: unknown) {
      const errorObj = err as Error;
      const isTimeout = errorObj.name === "AbortError" || errorObj.name === "TimeoutError";
      const code = isTimeout ? "TIMEOUT" : "NETWORK_ERROR";
      const message = isTimeout ? "Operation timed out after 5000ms" : (errorObj.message || "Network request failed");

      if (attempt < maxRetries) {
        attempt++;
        const timeScale = Number.parseFloat(process.env.DEMO_TIME_SCALE || "0.1") || 0.1;
        const delay = Math.max(10, Math.round(backoffMs * attempt * timeScale));
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return {
        request: requestInfo,
        error: { message, code },
      };
    }
  }
}

// ==========================================
// Step Schemas
// ==========================================

export const ValidateLeadInputSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: z.string().email("Valid email is required"),
  company: z.string().min(1, "company is required"),
});
export type ValidateLeadInput = z.infer<typeof ValidateLeadInputSchema>;

export const EnrichCompanyInputSchema = z.object({
  company: z.string().min(1, "company is required"),
}).passthrough();
export type EnrichCompanyInput = z.infer<typeof EnrichCompanyInputSchema>;

export const EnrichCompanyOutputSchema = z.object({
  company: z.string(),
  employees: z.number(),
  industry: z.string(),
});
export type EnrichCompanyOutput = z.infer<typeof EnrichCompanyOutputSchema>;

export const SaveToCrmInputSchema = z.object({
  full_name: z.string().min(1, "full_name is required"),
  email: z.string().email("Valid email is required"),
  company: z.string().min(1, "company is required"),
  employees: z.number().int().nonnegative("employees must be a non-negative number"),
});
export type SaveToCrmInput = z.infer<typeof SaveToCrmInputSchema>;

export const SaveToCrmOutputSchema = z.object({
  crmId: z.string(),
  status: z.string(),
  lead: z.object({
    full_name: z.string(),
    email: z.string(),
    company: z.string(),
    employees: z.number(),
  }),
  createdAt: z.string(),
});
export type SaveToCrmOutput = z.infer<typeof SaveToCrmOutputSchema>;

export const SendFollowupInputSchema = z.object({
  to: z.string().email("Valid to email is required"),
  subject: z.string().min(1, "subject is required"),
  body: z.string().min(1, "body is required"),
});
export type SendFollowupInput = z.infer<typeof SendFollowupInputSchema>;

export const SendFollowupOutputSchema = z.object({
  messageId: z.string(),
  status: z.string(),
  deliveredTo: z.string(),
  subject: z.string(),
  dispatchedAt: z.string(),
});
export type SendFollowupOutput = z.infer<typeof SendFollowupOutputSchema>;

// ==========================================
// Lead-to-CRM Step Definitions
// ==========================================

export const validateLeadStep: StepDefinition<ValidateLeadInput, ValidateLeadInput> = {
  name: "validate_lead",
  expectedInputSchema: ValidateLeadInputSchema,
  expectedOutputSchema: ValidateLeadInputSchema,
  defaultConfig: {
    fieldMapping: {},
    coerceRules: {},
    maxRetries: 0,
    backoffMs: 500,
  },
  inputResolver: ({ inputPayload }) => inputPayload,
  handler: async (input, config) => {
    const request = { method: "LOCAL", body: input };
    const transformed = applyDataTransforms(input as Record<string, unknown>, config);
    const parsed = ValidateLeadInputSchema.safeParse(transformed);

    if (!parsed.success) {
      return {
        success: false,
        request,
        errorMessage: `Input schema violation: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
        errorCode: "INPUT_SCHEMA_VIOLATION",
      };
    }

    return {
      success: true,
      output: parsed.data,
      request,
      response: {
        status: 200,
        headers: { "content-type": "application/json" },
        body: parsed.data,
      },
    };
  },
};

export const enrichCompanyStep: StepDefinition<EnrichCompanyInput, EnrichCompanyOutput> = {
  name: "enrich_company",
  expectedInputSchema: EnrichCompanyInputSchema,
  expectedOutputSchema: EnrichCompanyOutputSchema,
  defaultConfig: {
    endpoint: "/api/mock/enrichment",
    maxRetries: 0,
    backoffMs: 1000,
    fieldMapping: {},
    coerceRules: {},
  },
  inputResolver: ({ inputPayload, stepOutputs }) => {
    const valLead = (stepOutputs.validate_lead as Record<string, unknown>) || {};
    return {
      company: (valLead.company as string) || (inputPayload.company as string) || "Acme Corp",
    };
  },
  handler: async (input, config) => {
    const fallbackUrl = resolveUrl(config.endpoint || "/api/mock/enrichment");
    const maxRetries = config?.maxRetries ?? 0;
    const backoffMs = config?.backoffMs ?? 1000;
    let attempt = 0;

    while (true) {
      // Route through Fault-Injection Proxy (supports Abstract API / Hunter / mock fallback)
      const callResult = await executeThroughProxy(
        { service: "enrichment", endpointOverride: config.endpoint },
        () => fetchCompanyEnrichment({ company: input.company }, fallbackUrl)
      );

      if (!callResult.success || !callResult.response || callResult.response.status >= 400) {
        const status = callResult.response?.status || 500;
        if (attempt < maxRetries && (status === 429 || status >= 500)) {
          attempt++;
          const retryAfter = callResult.response?.headers?.["retry-after"];
          const rawDelay = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : backoffMs * attempt;
          const timeScale = Number.parseFloat(process.env.DEMO_TIME_SCALE || "0.1") || 0.1;
          const delay = Math.max(10, Math.round(rawDelay * timeScale));
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return {
          success: false,
          request: { ...callResult.request, mode: callResult.mode },
          response: callResult.response,
          errorMessage: callResult.errorMessage || `Enrichment HTTP failure ${callResult.response?.status}`,
          errorCode: callResult.errorCode || `HTTP_${callResult.response?.status}`,
        };
      }

      // Apply config transforms (e.g. remapping staff_count -> employees, coercion)
      const rawBody = (callResult.response.body && typeof callResult.response.body === "object")
        ? (callResult.response.body as Record<string, unknown>)
        : {};
      const transformed = applyDataTransforms(rawBody, config);

      // Validate output against expectedOutputSchema
      const parseResult = EnrichCompanyOutputSchema.safeParse(transformed);
      if (!parseResult.success) {
        return {
          success: false,
          request: { ...callResult.request, mode: callResult.mode },
          response: callResult.response,
          errorMessage: `Output schema violation on enrich_company: ${parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
          errorCode: "OUTPUT_SCHEMA_VIOLATION",
        };
      }

      return {
        success: true,
        output: parseResult.data,
        request: { ...callResult.request, mode: callResult.mode },
        response: callResult.response,
      };
    }
  },
};


export const saveToCrmStep: StepDefinition<SaveToCrmInput, SaveToCrmOutput> = {
  name: "save_to_crm",
  expectedInputSchema: SaveToCrmInputSchema,
  expectedOutputSchema: SaveToCrmOutputSchema,
  defaultConfig: {
    endpoint: "/api/mock/crm",
    maxRetries: 0,
    backoffMs: 1000,
    fieldMapping: {},
    coerceRules: {},
  },
  inputResolver: ({ inputPayload, stepOutputs }) => {
    const valLead = (stepOutputs.validate_lead as Record<string, unknown>) || {};
    const enrich = (stepOutputs.enrich_company as Record<string, unknown>) || {};
    return {
      full_name: (valLead.name as string) || (inputPayload.name as string),
      email: (valLead.email as string) || (inputPayload.email as string),
      company: (enrich.company as string) || (valLead.company as string) || (inputPayload.company as string),
      employees: enrich.employees,
    };
  },
  handler: async (input, config) => {
    const transformedInput = applyDataTransforms(input as Record<string, unknown>, config);
    const inputParse = SaveToCrmInputSchema.safeParse(transformedInput);

    if (!inputParse.success) {
      return {
        success: false,
        request: { method: "POST", body: transformedInput, mode: "real" },
        errorMessage: `Input schema violation for save_to_crm: ${inputParse.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
        errorCode: "INPUT_SCHEMA_VIOLATION",
      };
    }

    const fallbackUrl = resolveUrl(config.endpoint || "/api/mock/crm");

    // Route through Fault-Injection Proxy (supports HubSpot / Google Sheets / mock fallback)
    const callResult = await executeThroughProxy(
      { service: "crm", endpointOverride: config.endpoint },
      () => createOrUpdateCrmContact(inputParse.data, fallbackUrl)
    );

    if (!callResult.success || !callResult.response || callResult.response.status >= 400) {
      return {
        success: false,
        request: { ...callResult.request, mode: callResult.mode },
        response: callResult.response,
        errorMessage: callResult.errorMessage || `CRM API returned ${callResult.response?.status}`,
        errorCode: callResult.errorCode || `HTTP_${callResult.response?.status}`,
      };
    }

    const rawBody = (callResult.response.body && typeof callResult.response.body === "object")
      ? (callResult.response.body as Record<string, unknown>)
      : {};
    const parseResult = SaveToCrmOutputSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return {
        success: false,
        request: { ...callResult.request, mode: callResult.mode },
        response: callResult.response,
        errorMessage: `Output schema violation on save_to_crm: ${parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
        errorCode: "OUTPUT_SCHEMA_VIOLATION",
      };
    }

    return {
      success: true,
      output: parseResult.data,
      request: { ...callResult.request, mode: callResult.mode },
      response: callResult.response,
    };
  },
};

export const sendFollowupStep: StepDefinition<SendFollowupInput, SendFollowupOutput> = {
  name: "send_followup",
  expectedInputSchema: SendFollowupInputSchema,
  expectedOutputSchema: SendFollowupOutputSchema,
  defaultConfig: {
    endpoint: "/api/mock/email",
    maxRetries: 0,
    backoffMs: 1000,
    fieldMapping: {},
    coerceRules: {},
  },
  inputResolver: ({ inputPayload, stepOutputs }) => {
    const valLead = (stepOutputs.validate_lead as Record<string, unknown>) || {};
    const enrich = (stepOutputs.enrich_company as Record<string, unknown>) || {};
    const crm = (stepOutputs.save_to_crm as Record<string, unknown>) || {};

    const name = (valLead.name as string) || (inputPayload.name as string) || "Customer";
    const company = (enrich.company as string) || (valLead.company as string) || (inputPayload.company as string) || "Your Organization";

    return {
      to: (valLead.email as string) || (inputPayload.email as string),
      subject: `Welcome to AutoMedic, ${name}!`,
      body: `Your company ${company} has been verified and registered into our CRM system (Record ID: ${crm.crmId || "pending"}).`,
    };
  },
  handler: async (input, config) => {
    const transformedInput = applyDataTransforms(input as Record<string, unknown>, config);
    const inputParse = SendFollowupInputSchema.safeParse(transformedInput);

    if (!inputParse.success) {
      return {
        success: false,
        request: { method: "POST", body: transformedInput, mode: "real" },
        errorMessage: `Input schema violation for send_followup: ${inputParse.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
        errorCode: "INPUT_SCHEMA_VIOLATION",
      };
    }

    const fallbackUrl = resolveUrl(config.endpoint || "/api/mock/email");

    // Route through Fault-Injection Proxy (supports Resend / EmailJS / mock fallback)
    const callResult = await executeThroughProxy(
      { service: "email", endpointOverride: config.endpoint },
      () => sendEmailFollowup(inputParse.data, fallbackUrl)
    );

    if (!callResult.success || !callResult.response || callResult.response.status >= 400) {
      return {
        success: false,
        request: { ...callResult.request, mode: callResult.mode },
        response: callResult.response,
        errorMessage: callResult.errorMessage || `Email service returned ${callResult.response?.status}`,
        errorCode: callResult.errorCode || `HTTP_${callResult.response?.status}`,
      };
    }

    const rawBody = (callResult.response.body && typeof callResult.response.body === "object")
      ? (callResult.response.body as Record<string, unknown>)
      : {};
    const parseResult = SendFollowupOutputSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return {
        success: false,
        request: { ...callResult.request, mode: callResult.mode },
        response: callResult.response,
        errorMessage: `Output schema violation on send_followup: ${parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
        errorCode: "OUTPUT_SCHEMA_VIOLATION",
      };
    }

    return {
      success: true,
      output: parseResult.data,
      request: { ...callResult.request, mode: callResult.mode },
      response: callResult.response,
    };
  },
};

// ==========================================
// Workflows Registry
// ==========================================

export const leadToCrmWorkflow: StepDefinition[] = [
  validateLeadStep,
  enrichCompanyStep,
  saveToCrmStep,
  sendFollowupStep,
];

export const WORKFLOWS: Record<string, StepDefinition[]> = {
  lead_to_crm: leadToCrmWorkflow,
};

export function getWorkflow(name: string): StepDefinition[] {
  const wf = WORKFLOWS[name];
  if (!wf) {
    throw new Error(`Workflow '${name}' not found.`);
  }
  // Return deep clone of steps with their default configs
  return wf.map((step) => ({
    ...step,
    defaultConfig: {
      ...step.defaultConfig,
      fieldMapping: { ...(step.defaultConfig.fieldMapping || {}) },
      coerceRules: { ...(step.defaultConfig.coerceRules || {}) },
    },
  }));
}
