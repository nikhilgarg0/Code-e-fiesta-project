import type { Diagnosis, IncidentDecision, ValidationResult } from "../types";

export const MIN_AUTO_CONFIDENCE = 0.8;
export const ALLOWED_AUTO_RISK_LEVEL = "low";

/**
 * Pure decision policy mapping diagnosis and validation results to an IncidentDecision.
 *
 * Rules:
 * - validation.valid === false -> "rejected_by_validator"
 * - riskLevel === "low" && confidence >= 0.8 && validation.valid && !validation.requiresApproval -> "auto_applied"
 * - everything else -> "pending"
 */
export function decide(
  diagnosis: Diagnosis,
  validation: ValidationResult
): IncidentDecision {
  if (!validation.valid) {
    return "rejected_by_validator";
  }

  const isLowRisk = diagnosis.riskLevel === ALLOWED_AUTO_RISK_LEVEL;
  const hasHighConfidence = diagnosis.confidence >= MIN_AUTO_CONFIDENCE;
  const autoApproved = isLowRisk && hasHighConfidence && !validation.requiresApproval;

  if (autoApproved) {
    return "auto_applied";
  }

  return "pending";
}
