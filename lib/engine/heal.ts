import { getIncident, updateIncident, addStepLog, updateRun } from "../firebase/repo";
import { diagnoseIncident } from "./diagnose";
import { validateFix } from "./validate";
import { decide } from "./policy";
import { resumeRun } from "./executor";
import { StepConfig } from "./workflows";
import { DiagnosisAttempt, IncidentDecision } from "../types";

/**
 * Constructs a StepConfig patch from a proposed fix object.
 */
export function buildConfigPatch(proposedFix: {
  type: string;
  params?: Record<string, unknown>;
}): Partial<StepConfig> {
  const params = proposedFix.params || {};

  switch (proposedFix.type) {
    case "remap_field": {
      const source = (params.source || params.from || params.sourceField || params.source_field) as string;
      const target = (params.target || params.to || params.targetField || params.target_field) as string;
      return { fieldMapping: { [target]: source } };

    }
    case "coerce_type": {
      const field = (params.field || "employees") as string;
      const targetType = (params.targetType || "number") as "number" | "string" | "boolean";
      return { coerceRules: { [field]: targetType } };
    }
    case "retry_with_backoff": {
      const maxRetries = typeof params.maxRetries === "number" ? params.maxRetries : 3;
      let backoffMs = 1000;
      if (typeof params.backoffMs === "number") {
        backoffMs = params.backoffMs;
      } else if (typeof params.initialDelayMs === "number") {
        backoffMs = params.initialDelayMs;
      } else if (typeof params.retryAfterSeconds === "number") {
        backoffMs = params.retryAfterSeconds * 1000;
      }
      return { maxRetries, backoffMs };
    }
    case "switch_to_fallback_endpoint": {
      const endpoint = (params.fallbackEndpoint || params.endpoint) as string;
      return { endpoint };
    }
    case "skip_step": {
      return { skip: true };
    }
    default:
      return {};
  }
}

/**
 * Main self-healing orchestrator for AutoMedic.
 * Flow: healing status -> diagnose -> validate -> decide -> apply -> resume.
 */
export async function healIncident(incidentId: string): Promise<void> {
  const incident = await getIncident(incidentId);
  if (!incident) {
    console.error(`[AutoMedic Heal] Incident '${incidentId}' not found.`);
    return;
  }

  const runId = incident.runId;

  // 1. Mark run as healing
  await updateRun(runId, { status: "healing" });

  // 10s/20s Watchdog: If a run sits in 'healing' for more than 20s with no new autobot step,
  // mark incident 'pending', set run to 'awaiting_approval', and log autobot:watchdog.
  const WATCHDOG_MS = 25000;
  let watchdogTriggered = false;
  let watchdogTimer: NodeJS.Timeout | null = null;

  const resetWatchdog = () => {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(async () => {
      watchdogTriggered = true;
      console.warn(`[AutoMedic Watchdog] Incident ${incidentId} exceeded ${WATCHDOG_MS}ms without progress. Forcing fallback.`);
      try {
        await updateRun(runId, { status: "awaiting_approval" });
        await updateIncident(incidentId, {
          decision: "pending",
          errorContext: {
            ...(incident.errorContext || {}),
            watchdogTimeout: `Healing exceeded ${WATCHDOG_MS}ms with no new autobot step. Safe fallback to operator review.`,
          },
        });
        await addStepLog(runId, {
          stepName: "autobot:watchdog",
          status: "failed",
          request: { incidentId, timeoutThresholdMs: WATCHDOG_MS },
          response: { recovered: true, newStatus: "awaiting_approval" },
          errorMessage: `Healing took longer than ${WATCHDOG_MS}ms with no new autobot step. Incident marked pending and escalated to human approval.`,
          errorCode: "WATCHDOG_TIMEOUT",
          durationMs: WATCHDOG_MS,
          timestamp: new Date().toISOString(),
        });
      } catch (watchdogErr) {
        console.error(`[AutoMedic Watchdog] Recovery failed for incident ${incidentId}:`, watchdogErr);
      }
    }, WATCHDOG_MS);
  };

  resetWatchdog();

  let diagnosis;
  let validation;
  const attempts: DiagnosisAttempt[] = [];

  try {

  // 2. Stage 1: Diagnosis & Validation (with error resilience)
  try {
    diagnosis = await diagnoseIncident(incidentId);
    resetWatchdog();
    validation = await validateFix(incidentId);
    resetWatchdog();
    attempts.push({ attempt: 1, diagnosis, validationResult: validation });
  } catch (err: unknown) {
    console.error(`[AutoMedic Heal] Gemini diagnosis failed for incident ${incidentId}:`, err);
    const message = err instanceof Error ? err.message : String(err);

    await updateIncident(incidentId, {
      decision: "pending",
      errorContext: {
        ...(incident.errorContext || {}),
        diagnosisError: message,
      },
    });

    await updateRun(runId, { status: "awaiting_approval" });

    await addStepLog(runId, {
      stepName: "autobot:error",
      status: "failed",
      request: { incidentId },
      response: { error: message },
      errorMessage: `AI Diagnosis unavailable: ${message}. Escalated to human approval.`,
      errorCode: "DIAGNOSIS_UNAVAILABLE",
      durationMs: 0,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 3. Stage: One Bounded Re-Diagnosis if validator rejected attempt 1
  if (!validation.valid) {
    const failedChecks = validation.checks
      .filter((c) => !c.passed)
      .map((c) => `${c.name} (${c.detail})`)
      .join("; ");

    const feedback = `Your previous fix proposal '${diagnosis.proposedFix.type}' was rejected by the validator due to failed checks: ${failedChecks}. Please re-examine the raw evidence and propose an alternative valid fix.`;

    try {
      diagnosis = await diagnoseIncident(incidentId, feedback);
      validation = await validateFix(incidentId);
      attempts.push({ attempt: 2, diagnosis, validationResult: validation });
    } catch (reErr: unknown) {
      console.warn(`[AutoMedic Heal] Re-diagnosis attempt failed for ${incidentId}:`, reErr);
    }
  }

  // Persist diagnosis attempts onto the incident
  await updateIncident(incidentId, {
    diagnosisAttempts: attempts,
    diagnosis,
    proposedFix: diagnosis.proposedFix,
    riskLevel: diagnosis.riskLevel,
  });

  // 4. Log timeline stages with 'autobot:' prefix
  await addStepLog(runId, {
    stepName: "autobot:diagnosed",
    status: "success",
    request: { incidentId, attempts: attempts.length },
    response: {
      rootCause: diagnosis.rootCause,
      failureCategory: diagnosis.failureCategory,
      proposedFix: diagnosis.proposedFix,
      confidence: diagnosis.confidence,
      riskLevel: diagnosis.riskLevel,
    },
    errorMessage: null,
    errorCode: null,
    durationMs: 0,
    timestamp: new Date().toISOString(),
  });

  resetWatchdog();

  await addStepLog(runId, {
    stepName: "autobot:validated",
    status: validation.valid ? "success" : "failed",
    request: { proposedFix: diagnosis.proposedFix },
    response: {
      valid: validation.valid,
      requiresApproval: validation.requiresApproval,
      checks: validation.checks,
    },
    errorMessage: validation.valid ? null : "Fix failed validator checks",
    errorCode: validation.valid ? null : "VALIDATOR_REJECTED",
    durationMs: 0,
    timestamp: new Date().toISOString(),
  });

  resetWatchdog();

  // 5. Evaluate Decision Policy
  const decision: IncidentDecision = decide(diagnosis, validation);

  await addStepLog(runId, {
    stepName: "autobot:decided",
    status: "success",
    request: {
      riskLevel: diagnosis.riskLevel,
      confidence: diagnosis.confidence,
      valid: validation.valid,
      requiresApproval: validation.requiresApproval,
    },
    response: { decision },
    errorMessage: null,
    errorCode: null,
    durationMs: 0,
    timestamp: new Date().toISOString(),
  });

  resetWatchdog();

  await updateIncident(incidentId, { decision });

  if (watchdogTriggered) {
    console.warn(`[AutoMedic Heal] Watchdog already triggered for incident ${incidentId}. Aborting normal flow.`);
    return;
  }

  // 6. Actuate Decision
  if (decision === "auto_applied") {
    const patch = buildConfigPatch(diagnosis.proposedFix);

    await addStepLog(runId, {
      stepName: "autobot:applied",
      status: "success",
      request: { patch, targetStep: incident.failedStep },
      response: { action: "auto_applied", appliedAt: new Date().toISOString() },
      errorMessage: null,
      errorCode: null,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    });

    resetWatchdog();

    await addStepLog(runId, {
      stepName: "autobot:resumed",
      status: "running",
      request: { fromStep: incident.failedStep },
      response: { resuming: true },
      errorMessage: null,
      errorCode: null,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    });

    // Resume execution
    await resumeRun(runId, incident.failedStep, patch, "auto");
  } else {
    // Escalate to human approval
    await updateRun(runId, { status: "awaiting_approval" });
  }
} finally {
  if (watchdogTimer) clearTimeout(watchdogTimer);
}
}

/**
 * Non-blocking event hook invoked when an incident is created by the executor.
 */
export async function onIncidentCreated(incidentId: string): Promise<void> {
  console.log(`[AutoMedic Heal Engine] onIncidentCreated triggered for incident: ${incidentId}`);
  // Asynchronously launch healing without holding up the initial run trigger
  healIncident(incidentId).catch((err) => {
    console.error(`[AutoMedic Heal Engine] Unhandled healing error on incident ${incidentId}:`, err);
  });
}
