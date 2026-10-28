import { getIncident, updateIncident } from "../firebase/repo";
import { getWorkflow, resolveUrl } from "./workflows";
import { ValidationCheck, ValidationResult } from "../types";
import { z } from "zod";

/**
 * Validates an AI-proposed fix by dry-running it against the captured incident context.
 * Strict purity: Never writes to runs, steps, or config/chaos.
 */
export async function validateFix(
  incidentId: string,
  overrideFix?: Record<string, unknown>
): Promise<ValidationResult> {
  const incident = await getIncident(incidentId);
  if (!incident) {
    throw new Error(`Incident '${incidentId}' not found for validation.`);
  }

  const proposedFix = (overrideFix || incident.proposedFix || incident.diagnosis?.proposedFix) as
    | { type: string; params: Record<string, unknown>; explanation?: string }
    | undefined;

  const riskLevel = incident.riskLevel || incident.diagnosis?.riskLevel || "medium";
  const errCtx = (incident.errorContext || {}) as Record<string, unknown>;
  const rawResponse = (errCtx.response || {}) as {
    status?: number;
    headers?: Record<string, string>;
    body?: unknown;
  };
  const rawBody =
    rawResponse.body && typeof rawResponse.body === "object"
      ? (rawResponse.body as Record<string, unknown>)
      : {};

  const stepDef = getWorkflow("lead_to_crm").find((s) => s.name === incident.failedStep);
  const expectedOutputSchema = stepDef?.expectedOutputSchema;

  const checks: ValidationCheck[] = [];
  let requiresApproval = riskLevel === "medium" || riskLevel === "high";

  if (!proposedFix || !proposedFix.type) {
    const result: ValidationResult = {
      valid: false,
      requiresApproval: true,
      checks: [
        {
          name: "fix_present",
          passed: false,
          detail: "No proposed fix found on incident.",
        },
      ],
      validatedAt: new Date().toISOString(),
    };
    await updateIncident(incidentId, { validationResult: result });
    return result;
  }

  const fixType = proposedFix.type;
  const params = proposedFix.params || {};

  switch (fixType) {
    case "remap_field": {
      const source = (params.source || params.from || params.sourceField || params.source_field) as string;
      const target = (params.target || params.to || params.targetField || params.target_field) as string;


      // Check 1: source_field_exists
      const sourceExists = typeof source === "string" && source in rawBody && rawBody[source] !== undefined;
      checks.push({
        name: "source_field_exists",
        passed: sourceExists,
        detail: sourceExists
          ? `Source field '${source}' exists in captured response (value: ${JSON.stringify(rawBody[source])}).`
          : `Source field '${source}' does not exist in response body.`,
      });

      // Check 2: target_field_expected
      let targetExpected = false;
      if (expectedOutputSchema instanceof z.ZodObject && typeof target === "string") {
        targetExpected = target in (expectedOutputSchema as unknown as { shape: Record<string, unknown> }).shape;
      }
      checks.push({
        name: "target_field_expected",
        passed: targetExpected,
        detail: targetExpected
          ? `Target field '${target}' is an expected field in '${incident.failedStep}' output schema.`
          : `Target field '${target}' is not an expected output field.`,
      });

      // Check 3: type_compatibility
      let typeCompatible = false;
      if (sourceExists && targetExpected) {
        const sourceVal = rawBody[source];
        // Target in enrich_company is 'employees' which expects number
        if (target === "employees") {
          typeCompatible = typeof sourceVal === "number" && !Number.isNaN(sourceVal);
        } else {
          typeCompatible = sourceVal !== null && sourceVal !== undefined;
        }
      }
      checks.push({
        name: "type_compatibility",
        passed: typeCompatible,
        detail: typeCompatible
          ? `Source field '${source}' type ('${typeof rawBody[source]}') is compatible with expected target type.`
          : `Source field '${source}' value type is incompatible with target '${target}'.`,
      });

      // Check 4: ambiguity_check
      // If proposed source ends with _old, _legacy, _deprecated, or is a known decoy, FAIL.
      const isDecoy =
        typeof source === "string" &&
        (source.endsWith("_old") ||
          source.endsWith("_legacy") ||
          source.endsWith("_deprecated") ||
          source.includes("old") ||
          source.includes("legacy"));

      // Also detect if other numeric candidate fields exist
      const otherPlausibleCandidates = Object.keys(rawBody).filter(
        (k) =>
          k !== source &&
          typeof rawBody[k] === "number" &&
          (k.includes("count") || k.includes("employee") || k.includes("staff"))
      );

      if (isDecoy) {
        checks.push({
          name: "ambiguity_check",
          passed: false,
          detail: `Ambiguity check failed: proposed source '${source}' ends with a deprecated suffix ('_old') while valid alternative candidate '${otherPlausibleCandidates.join(", ")}' was also present.`,
        });
      } else if (otherPlausibleCandidates.length > 0) {
        // Source is not decoy, but alternatives were present -> pass check with approval required
        requiresApproval = true;
        checks.push({
          name: "ambiguity_check",
          passed: true,
          detail: `Ambiguity check passed: proposed source '${source}' is valid. Decoy alternative candidate '${otherPlausibleCandidates.join(", ")}' safely bypassed.`,
        });
      } else {
        checks.push({
          name: "ambiguity_check",
          passed: true,
          detail: "No competing candidate fields found in response body.",
        });
      }

      // Check 5: output_schema_validation
      if (sourceExists && targetExpected && expectedOutputSchema) {
        const remappedBody = { ...rawBody, [target]: rawBody[source] };
        const parseResult = expectedOutputSchema.safeParse(remappedBody);
        if (parseResult.success) {
          checks.push({
            name: "output_schema_validation",
            passed: true,
            detail: `Remapped payload successfully satisfied output schema for '${incident.failedStep}'.`,
          });
        } else {
          checks.push({
            name: "output_schema_validation",
            passed: false,
            detail: `Remapped payload failed schema validation: ${parseResult.error.issues.map((i) => i.message).join(", ")}.`,
          });
        }
      }
      break;
    }

    case "coerce_type": {
      const field = (params.field || "employees") as string;
      const targetType = (params.targetType || "number") as string;
      const originalVal = rawBody[field];
      const isStrict = params.strict === true;

      // Check 1: coercion_applicable
      const fieldExists = field in rawBody;
      checks.push({
        name: "coercion_applicable",
        passed: fieldExists && ["number", "string", "boolean"].includes(targetType),
        detail: fieldExists
          ? `Coercion rule to '${targetType}' is applicable to field '${field}' (current value: ${JSON.stringify(originalVal)}).`
          : `Field '${field}' not found in raw response.`,
      });

      // Check 2: coercion_execution
      if (targetType === "number") {
        if (isStrict) {
          // Strict number conversion fails on text like "approx 50"
          const isStrictNumeric = typeof originalVal === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(originalVal);
          const strictNum = Number(originalVal);
          const strictPassed = isStrictNumeric && !Number.isNaN(strictNum);

          checks.push({
            name: "coercion_execution",
            passed: strictPassed,
            detail: strictPassed
              ? `Strict number coercion succeeded: ${strictNum}.`
              : `Strict coercion failed: '${originalVal}' produces NaN under strict number conversion rules without lossy text stripping.`,
          });
        } else {
          // Permissive coercion with text stripping
          const str = String(originalVal || "");
          const stripped = str.replace(/[^\d.-]/g, "");
          const num = Number.parseFloat(stripped);
          const validNum = !Number.isNaN(num) && stripped.length > 0;

          if (validNum) {
            const strippedText = /[^\d.-]/.test(str);
            if (strippedText) {
              requiresApproval = true;
            }
            checks.push({
              name: "coercion_execution",
              passed: true,
              detail: strippedText
                ? `Coercion succeeded by stripping non-numeric text ('${str}' -> ${num}). Requires human approval.`
                : `Coercion parsed clean numeric value: ${num}.`,
            });

            // Check 3: output_schema_validation
            if (expectedOutputSchema) {
              const coercedBody = { ...rawBody, [field]: num };
              const parseResult = expectedOutputSchema.safeParse(coercedBody);
              if (parseResult.success) {
                checks.push({
                  name: "output_schema_validation",
                  passed: true,
                  detail: "Coerced payload successfully passed output schema.",
                });
              } else {
                checks.push({
                  name: "output_schema_validation",
                  passed: false,
                  detail: `Coerced payload failed output schema: ${parseResult.error.issues.map((i) => i.message).join(", ")}.`,
                });
              }
            }
          } else {
            checks.push({
              name: "coercion_execution",
              passed: false,
              detail: `Coercion failed: '${originalVal}' produced NaN/null.`,
            });
          }
        }
      }
      break;
    }

    case "retry_with_backoff": {
      const statusCode = rawResponse.status || 0;
      const isRetryableStatus = statusCode === 429 || (statusCode >= 500 && statusCode <= 599);

      // Check 1: retryable_failure_status
      checks.push({
        name: "retryable_failure_status",
        passed: isRetryableStatus,
        detail: isRetryableStatus
          ? `HTTP status ${statusCode} is genuinely retryable (429 or 5xx).`
          : `HTTP status ${statusCode} is not a retryable transient failure.`,
      });

      // Check 2: retry_limits
      const maxRetries = typeof params.maxRetries === "number" ? params.maxRetries : 3;
      let totalBackoffMs = 0;
      let firstBackoffMs = 1000;

      if (Array.isArray(params.backoffMs)) {
        totalBackoffMs = (params.backoffMs as number[]).reduce((a, b) => a + b, 0);
        firstBackoffMs = (params.backoffMs as number[])[0] || 1000;
      } else if (typeof params.backoffMs === "number") {
        firstBackoffMs = params.backoffMs;
        totalBackoffMs = maxRetries * params.backoffMs;
      } else if (typeof params.retryAfterSeconds === "number") {
        firstBackoffMs = params.retryAfterSeconds * 1000;
        totalBackoffMs = firstBackoffMs * maxRetries;
      } else {
        totalBackoffMs = maxRetries * 1000;
      }

      const withinLimits = maxRetries <= 5 && totalBackoffMs <= 30000;
      checks.push({
        name: "retry_limits",
        passed: withinLimits,
        detail: withinLimits
          ? `Retry limits respected: maxRetries=${maxRetries} (<= 5), simulated totalBackoff=${totalBackoffMs}ms (<= 30000ms).`
          : `Retry limits exceeded: maxRetries=${maxRetries} (limit 5) or totalBackoff=${totalBackoffMs}ms (limit 30000ms).`,
      });

      // Check 3: retry_after_respected
      const headers = rawResponse.headers || {};
      const retryAfterHeader = headers["retry-after"];
      let retryAfterRespected = true;
      let retryAfterDetail = "No Retry-After header present in captured response.";

      if (retryAfterHeader) {
        const retryAfterSec = Number.parseInt(retryAfterHeader, 10);
        if (!Number.isNaN(retryAfterSec)) {
          const minFirstBackoff = retryAfterSec * 1000;
          retryAfterRespected = firstBackoffMs >= minFirstBackoff;
          retryAfterDetail = retryAfterRespected
            ? `Initial backoff (${firstBackoffMs}ms) respects Retry-After header (${retryAfterSec}s).`
            : `Initial backoff (${firstBackoffMs}ms) is less than required Retry-After header (${retryAfterSec}s).`;
        }
      }

      checks.push({
        name: "retry_after_respected",
        passed: retryAfterRespected,
        detail: retryAfterDetail,
      });

      // Check 4: backoff_schedule_simulation
      const schedule = Array.from({ length: maxRetries }, (_, i) => firstBackoffMs * (i + 1));
      checks.push({
        name: "backoff_schedule_simulation",
        passed: true,
        detail: `Simulated schedule: [${schedule.join(", ")}] ms. Computed without blocking or mutating state.`,
      });
      break;
    }

    case "switch_to_fallback_endpoint": {
      const endpoint = (params.fallbackEndpoint || params.endpoint) as string;

      // Check 1: allowed_fallback
      // Fallback must be listed in step configuration or error response headers/body
      const stepConfig = (errCtx.stepConfig || {}) as Record<string, unknown>;
      const allowedFallbacks = ["/api/mock/enrichment-v2"];
      if (typeof stepConfig.fallbackEndpoint === "string") {
        allowedFallbacks.push(stepConfig.fallbackEndpoint);
      }
      if (typeof rawResponse.headers?.["x-fallback-endpoint"] === "string") {
        allowedFallbacks.push(rawResponse.headers["x-fallback-endpoint"]);
      }

      const isAllowed = typeof endpoint === "string" && allowedFallbacks.includes(endpoint);
      checks.push({
        name: "allowed_fallback",
        passed: isAllowed,
        detail: isAllowed
          ? `Fallback endpoint '${endpoint}' is verified in authorized step failover list.`
          : `Unauthorized fallback endpoint '${endpoint}'. Not listed in step configuration or verified service registry.`,
      });

      // Check 2: fallback_health_check
      let healthPassed = false;
      let healthDetail = "";
      let fallbackData: unknown = null;

      if (isAllowed) {
        try {
          const url = resolveUrl(endpoint);
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company: "DryRun Validation Test" }),
          });

          healthPassed = res.status === 200;
          healthDetail = healthPassed
            ? `Isolated dry-run probe to '${endpoint}' responded with HTTP 200.`
            : `Fallback health check failed with status HTTP ${res.status}.`;

          if (healthPassed) {
            fallbackData = await res.json();
          }
        } catch (fetchErr) {
          healthPassed = false;
          healthDetail = `Probe network connection failed: ${(fetchErr as Error).message}`;
        }
      } else {
        healthDetail = "Probe skipped due to unauthorized endpoint.";
      }

      checks.push({
        name: "fallback_health_check",
        passed: healthPassed,
        detail: healthDetail,
      });

      // Check 3: fallback_output_schema
      if (healthPassed && fallbackData && expectedOutputSchema) {
        const parseResult = expectedOutputSchema.safeParse(fallbackData);
        if (parseResult.success) {
          checks.push({
            name: "fallback_output_schema",
            passed: true,
            detail: `Fallback response payload conforms to '${incident.failedStep}' schema.`,
          });
        } else {
          checks.push({
            name: "fallback_output_schema",
            passed: false,
            detail: `Fallback payload schema mismatch: ${parseResult.error.issues.map((i) => i.message).join(", ")}.`,
          });
        }
      }
      break;
    }

    case "skip_step": {
      requiresApproval = true;
      checks.push({
        name: "data_loss_warning",
        passed: true,
        detail: `Step '${incident.failedStep}' will be skipped. Downstream steps will not receive its outputs and will fall back to defaults.`,
      });
      break;
    }

    default: {
      checks.push({
        name: "unknown_fix_type",
        passed: false,
        detail: `Unsupported or unknown fix type '${fixType}'.`,
      });
      break;
    }
  }

  const valid = checks.length > 0 && checks.every((c) => c.passed);

  const validationResult: ValidationResult = {
    valid,
    requiresApproval,
    checks,
    validatedAt: new Date().toISOString(),
  };

  // Purity guarantee: only write validationResult to the incident doc
  await updateIncident(incidentId, { validationResult });

  return validationResult;
}
