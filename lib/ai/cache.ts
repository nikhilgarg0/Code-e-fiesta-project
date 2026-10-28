import { Diagnosis } from "../types";

/**
 * Pre-written, schema-valid fallback diagnoses for all failing chaos modes.
 * Ensures AutoMedic never fails on stage, even under network disconnects or LLM outages.
 */
export const CACHED_DIAGNOSES: Record<string, Diagnosis> = {
  schema_drift: {
    rootCause:
      "Upstream enrichment API modified payload schema: field 'employees' renamed to 'staff_count'.",
    failureCategory: "schema_drift",
    confidence: 0.95,
    riskLevel: "low",
    evidence: [
      "HTTP 200 OK received from /api/mock/enrichment",
      "Response payload contains field 'staff_count': 85",
      "Expected output schema requires numeric field 'employees'",
    ],
    proposedFix: {
      type: "remap_field",
      params: { source: "staff_count", target: "employees" },
      explanation:
        "Map source field 'staff_count' to expected target field 'employees' on enrichment response.",
    },
    alternativesConsidered: [
      "skip_step: rejected due to business data loss",
      "retry_with_backoff: rejected as schema drift is permanent",
    ],
    source: "cache",
  },

  transient_500: {
    rootCause:
      "Upstream enrichment API returned transient HTTP 500 Internal Server Error.",
    failureCategory: "transient",
    confidence: 0.95,
    riskLevel: "low",
    evidence: [
      "HTTP 500 Internal Server Error received from /api/mock/enrichment",
      "Response body errorCode: 'INTERNAL_SERVER_ERROR'",
      "Failure pattern matches intermittent gateway glitch",
    ],
    proposedFix: {
      type: "retry_with_backoff",
      params: { maxRetries: 3, backoffMs: 1000 },
      explanation:
        "Retry step with exponential backoff schedule (max 3 retries, 1000ms base interval).",
    },
    alternativesConsidered: [
      "switch_to_fallback_endpoint: rejected as primary recovers after brief delay",
      "skip_step: rejected to prevent incomplete lead records",
    ],
    source: "cache",
  },

  rate_limit: {
    rootCause:
      "Upstream enrichment service rate limit exceeded (HTTP 429 Too Many Requests).",
    failureCategory: "rate_limit",
    confidence: 1.0,
    riskLevel: "low",
    evidence: [
      "HTTP 429 Too Many Requests received from /api/mock/enrichment",
      "Header 'retry-after': '2' seconds present in response",
      "Response body indicates API quota window temporarily exhausted",
    ],
    proposedFix: {
      type: "retry_with_backoff",
      params: { maxRetries: 3, backoffMs: 2000, retryAfterSeconds: 2 },
      explanation:
        "Respect the 2s Retry-After header and execute retries with backoff schedule.",
    },
    alternativesConsidered: [
      "skip_step: rejected due to criticality of enriched lead data",
    ],
    source: "cache",
  },

  bad_type: {
    rootCause:
      "Upstream returned string representation for employee headcount ('approx 50') where numeric type is required by CRM schema.",
    failureCategory: "bad_data",
    confidence: 0.95,
    riskLevel: "medium",
    evidence: [
      "HTTP 200 OK received from /api/mock/enrichment",
      "Response payload contains 'employees': 'approx 50' (string)",
      "save_to_crm expects 'employees' as type 'number'",
    ],
    proposedFix: {
      type: "coerce_type",
      params: { field: "employees", targetType: "number" },
      explanation:
        "Coerce 'employees' string value to numeric integer 50 before CRM persistence.",
    },
    alternativesConsidered: [
      "skip_step: rejected as company headcount is required for CRM lead scoring",
      "remap_field: no alternative headcount field present in response",
    ],
    source: "cache",
  },

  primary_down: {
    rootCause:
      "Primary enrichment endpoint /api/mock/enrichment suffered a sustained timeout outage.",
    failureCategory: "outage",
    confidence: 1.0,
    riskLevel: "low",
    evidence: [
      "Request to /api/mock/enrichment timed out after 5000ms",
      "ErrorCode: 'TIMEOUT'",
      "Configured fallback endpoint /api/mock/enrichment-v2 is healthy and operational",
    ],
    proposedFix: {
      type: "switch_to_fallback_endpoint",
      params: { fallbackEndpoint: "/api/mock/enrichment-v2" },
      explanation:
        "Switch step configuration to secondary healthy fallback endpoint /api/mock/enrichment-v2.",
    },
    alternativesConsidered: [
      "retry_with_backoff: primary endpoint unresponsive after retry threshold",
    ],
    source: "cache",
  },

  bad_fix_trap: {
    rootCause:
      "Response schema drift contains ambiguous headcount fields: active 'staff_count' and legacy 'employee_count_old'.",
    failureCategory: "schema_drift",
    confidence: 0.85,
    riskLevel: "low",
    evidence: [
      "Payload includes legacy field 'employee_count_old': 5",
      "Payload includes active field 'staff_count': 85",
      "Metadata warning marks employee_count_old as deprecated cached value",
    ],
    // Cached WRONG fix so the guardrail rejection can be demonstrated reliably on stage
    proposedFix: {
      type: "remap_field",
      params: { source: "employee_count_old", target: "employees" },
      explanation:
        "Propose mapping deprecated decoy field 'employee_count_old' to target 'employees'.",
    },
    alternativesConsidered: [
      "remap staff_count -> employees: alternative candidate considered",
    ],
    source: "cache",
  },
};

/**
 * Returns a realistic, schema-valid fallback Diagnosis for a given chaos mode.
 */
export function getCachedDiagnosis(mode = "schema_drift"): Diagnosis {
  const normalizedMode = mode.toLowerCase();
  const cached = CACHED_DIAGNOSES[normalizedMode];
  if (cached) {
    return { ...cached, source: "cache" };
  }
  return { ...CACHED_DIAGNOSES.schema_drift, source: "cache" };
}
