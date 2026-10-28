// lib/integrations/proxy.ts
// Fault-Injection Proxy: routes every real service adapter call through chaos testing.
// When chaos mode is "none", passes calls straight through.
// When a mode is active, executes the real call first (to capture real responses) and mutates data/errors.

import { getChaos, incrementChaosCounter } from "@/lib/firebase/repo";
import { AdapterExecutionResult } from "./enrichment";

export interface ProxyOptions {
  service: "enrichment" | "crm" | "email";
  endpointOverride?: string;
}

export async function executeThroughProxy<T>(
  options: ProxyOptions,
  realCallFn: () => Promise<AdapterExecutionResult<T>>
): Promise<AdapterExecutionResult<T>> {
  let chaosMode = "none";
  try {
    const chaosConfig = await getChaos();
    chaosMode = chaosConfig?.mode || "none";
  } catch (err) {
    console.warn("[AutoMedic Proxy] Could not load chaos config, defaulting to none:", err);
  }

  // PASS-THROUGH: When mode is "none", execute real service call directly
  if (chaosMode === "none") {
    return await realCallFn();
  }

  // FAULT-INJECTION FOR ENRICHMENT SERVICE
  if (options.service === "enrichment") {
    // 1. Transient 500: Fails first 2 attempts, then recovers
    if (chaosMode === "transient_500") {
      const attempt = await incrementChaosCounter("transient_500");
      if (attempt <= 2) {
        return {
          success: false,
          request: { url: "https://api.abstractapi.com/v1/enrichment", method: "GET" },
          response: {
            status: 500,
            headers: { "x-attempt-count": String(attempt) },
            body: {
              error: "InternalServerError",
              errorCode: "GATEWAY_TIMEOUT",
              message: "Enrichment upstream gateway timed out (connection reset by peer)",
              attempt,
              hint: "Transient downstream failure. Retrying with backoff will succeed.",
            },
          },
          errorMessage: "Enrichment upstream gateway timed out (500)",
          errorCode: "GATEWAY_TIMEOUT",
          mode: "real",
        };
      }
      // Attempt 3+: pass through to real call
      return await realCallFn();
    }

    // 2. Primary Down: 503 cluster offline, unless switched to fallback endpoint
    if (chaosMode === "primary_down") {
      const isFallback = options.endpointOverride?.includes("v2");
      if (!isFallback) {
        return {
          success: false,
          request: { url: "https://api.abstractapi.com/v1/enrichment", method: "GET" },
          response: {
            status: 503,
            headers: {
              "retry-after": "300",
              "x-fallback-endpoint": "/api/mock/enrichment-v2",
            },
            body: {
              error: "ServiceUnavailable",
              errorCode: "CLUSTER_OFFLINE",
              message: "Primary Enrichment cluster offline for maintenance. Failover endpoint available at /api/mock/enrichment-v2.",
              statusCode: 503,
              recommendedAction: "switch_to_fallback_endpoint",
              fallbackEndpoint: "/api/mock/enrichment-v2",
            },
          },
          errorMessage: "Primary Enrichment cluster offline (503)",
          errorCode: "CLUSTER_OFFLINE",
          mode: "real",
        };
      }
      // Switched to fallback: execute real call / fallback
      return await realCallFn();
    }

    // Execute real call first so real data is fetched
    const realResult = await realCallFn();

    // 3. Schema Drift: Renames 'employees' to 'staff_count'
    if (chaosMode === "schema_drift") {
      const baseBody = (realResult.response?.body && typeof realResult.response?.body === "object")
        ? (realResult.response.body as Record<string, unknown>)
        : {};

      const mutatedBody: Record<string, unknown> = {
        ...baseBody,
        company: (baseBody.company || baseBody.name || "Acme Corp") as string,
        staff_count: (baseBody.employees || baseBody.employees_count || 85) as number,
        industry: (baseBody.industry || "Software & AI") as string,
      };
      delete mutatedBody.employees;
      delete mutatedBody.employees_count;

      return {
        ...realResult,
        success: true,
        data: undefined as unknown as T, // Step will fail output schema check on 'employees'
        rawResponse: mutatedBody,
        response: {
          status: 200,
          headers: realResult.response?.headers || { "content-type": "application/json" },
          body: mutatedBody,
        },
      };
    }

    // 4. Bad Type: Mutates 'employees' from number to string 'approx 50'
    if (chaosMode === "bad_type") {
      const baseBody = (realResult.response?.body && typeof realResult.response?.body === "object")
        ? (realResult.response.body as Record<string, unknown>)
        : {};

      const mutatedBody: Record<string, unknown> = {
        ...baseBody,
        company: (baseBody.company || baseBody.name || "Acme Corp") as string,
        employees: "approx 50",
        industry: (baseBody.industry || "Software & AI") as string,
      };

      return {
        ...realResult,
        success: true,
        data: undefined as unknown as T,
        rawResponse: mutatedBody,
        response: {
          status: 200,
          headers: realResult.response?.headers || { "content-type": "application/json" },
          body: mutatedBody,
        },
      };
    }

    // 5. Bad Fix Trap: Injects decoy field 'employee_count_old' and metadata warning
    if (chaosMode === "bad_fix_trap") {
      const baseBody = (realResult.response?.body && typeof realResult.response?.body === "object")
        ? (realResult.response.body as Record<string, unknown>)
        : {};

      const mutatedBody: Record<string, unknown> = {
        ...baseBody,
        company: (baseBody.company || baseBody.name || "Acme Corp") as string,
        staff_count: 85,
        employee_count_old: 5,
        industry: (baseBody.industry || "Software & AI") as string,
        metadata: {
          legacyWarning: "employee_count_old is deprecated (cached 2018 value). staff_count is the active current headcount.",
        },
      };
      delete mutatedBody.employees;
      delete mutatedBody.employees_count;

      return {
        ...realResult,
        success: true,
        data: undefined as unknown as T,
        rawResponse: mutatedBody,
        response: {
          status: 200,
          headers: realResult.response?.headers || { "content-type": "application/json" },
          body: mutatedBody,
        },
      };
    }

    return realResult;
  }

  // FAULT-INJECTION FOR CRM SERVICE
  if (options.service === "crm") {
    // 6. Rate Limit (429): Returns 429 Too Many Requests with Retry-After header
    if (chaosMode === "rate_limit") {
      const attempt = await incrementChaosCounter("rate_limit");
      if (attempt <= 2) {
        return {
          success: false,
          request: { url: "https://api.hubapi.com/crm/v3/objects/contacts", method: "POST" },
          response: {
            status: 429,
            headers: {
              "retry-after": "1",
              "x-rate-limit-limit": "100",
              "x-rate-limit-remaining": "0",
              "x-attempt-count": String(attempt),
            },
            body: {
              error: "RateLimitExceeded",
              errorCode: "TOO_MANY_REQUESTS",
              message: "CRM API rate limit exceeded for client token. Please back off before retrying.",
              attempt,
              retryAfterSeconds: 1,
              hint: "Rate limit refreshes in 1 second. Use retry_with_backoff.",
            },
          },
          errorMessage: "CRM API rate limit exceeded (429)",
          errorCode: "TOO_MANY_REQUESTS",
          mode: "real",
        };
      }
      // Attempt 3+: pass through to real CRM
      return await realCallFn();
    }
  }

  // Default: pass through to real caller
  return await realCallFn();
}
