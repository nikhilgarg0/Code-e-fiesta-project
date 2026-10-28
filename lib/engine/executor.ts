import { createRun, updateRun, getRun, addStepLog, createIncident, getIncidentForRun, updateIncident } from "../firebase/repo";
import { getWorkflow, StepConfig, StepDefinition } from "./workflows";
import { onIncidentCreated } from "./heal";
import { z } from "zod";

function getReadableSchema(schema: z.ZodType): Record<string, string> | string {
  if (schema instanceof z.ZodObject) {
    const shape = (schema as any).shape;
    const desc: Record<string, string> = {};
    for (const [key, val] of Object.entries(shape)) {
      desc[key] = (val as any)._def?.typeName?.replace("Zod", "").toLowerCase() || "unknown";
    }
    return desc;
  }
  return schema.description || "Standard Zod Schema";
}

/**
 * Executes a sequence of steps from a specified starting index.
 * Handles step logging, incident creation upon failure, and state persistence.
 */
async function executePipeline(
  runId: string,
  inputPayload: Record<string, unknown>,
  steps: StepDefinition[],
  startIndex = 0,
  initialStepOutputs: Record<string, unknown> = {},
  options?: { isResume?: boolean; resolvedBy?: "auto" | "human" }
): Promise<void> {
  const stepOutputs: Record<string, unknown> = { ...initialStepOutputs };
  const run = await getRun(runId);
  const currentIncidentCount = run?.incidentCount || 1;

  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];

    // Check if step is configured to be skipped
    if (step.defaultConfig.skip) {
      await updateRun(runId, { currentStep: step.name });
      await addStepLog(runId, {
        stepName: step.name,
        status: "skipped",
        request: { method: "LOCAL", body: "Step skipped by AutoMedic fix" },
        response: null,
        errorMessage: null,
        errorCode: null,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    // 1. Update current step in Firestore
    await updateRun(runId, { currentStep: step.name });

    // 2. Resolve input for this step from payload & previous step outputs
    const resolvedInput = step.inputResolver
      ? step.inputResolver({ inputPayload, stepOutputs })
      : inputPayload;

    // 3. Validate step input against expectedInputSchema
    const inputValidation = step.expectedInputSchema.safeParse(resolvedInput);
    if (!inputValidation.success) {
      const errorMessage = `Input schema validation failed for ${step.name}: ${inputValidation.error.issues
        .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
        .join(", ")}`;

      await addStepLog(runId, {
        stepName: step.name,
        status: "failed",
        request: { method: "LOCAL", body: resolvedInput },
        response: null,
        errorMessage,
        errorCode: "INPUT_SCHEMA_VIOLATION",
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });

      await handleFailure(runId, step, {
        errorMessage,
        errorCode: "INPUT_SCHEMA_VIOLATION",
        request: { method: "LOCAL", body: resolvedInput },
        response: null,
        expectedSchema: getReadableSchema(step.expectedInputSchema),
        inputPayload,
        previousStepOutputs: { ...stepOutputs },
        stepConfig: { ...step.defaultConfig },
      }, currentIncidentCount, options?.isResume);
      return;
    }

    // 4. Execute step handler
    const startTime = Date.now();
    const result = await step.handler(inputValidation.data, step.defaultConfig);
    const durationMs = Date.now() - startTime;

    // 5. Handle failure
    if (!result.success) {
      await addStepLog(runId, {
        stepName: step.name,
        status: "failed",
        request: result.request,
        response: result.response ?? null,
        errorMessage: result.errorMessage ?? "Step execution failed",
        errorCode: result.errorCode ?? "STEP_FAILED",
        durationMs,
        timestamp: new Date().toISOString(),
      });

      await handleFailure(runId, step, {
        errorMessage: result.errorMessage ?? "Step execution failed",
        errorCode: result.errorCode ?? "STEP_FAILED",
        request: result.request,
        response: result.response ?? null,
        expectedSchema: getReadableSchema(step.expectedOutputSchema),
        inputPayload,
        previousStepOutputs: { ...stepOutputs },
        stepConfig: { ...step.defaultConfig },
      }, currentIncidentCount, options?.isResume);
      return;
    }

    // 6. Handle success
    await addStepLog(runId, {
      stepName: step.name,
      status: "success",
      request: result.request,
      response: result.response ?? null,
      errorMessage: null,
      errorCode: null,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    // Persist step output
    stepOutputs[step.name] = result.output || {};
    await updateRun(runId, {
      stepOutputs: { ...stepOutputs },
    });
  }

  // If this was a resumed run that succeeded, resolve the active incident first
  if (options?.isResume) {
    const incident = await getIncidentForRun(runId);
    if (incident && incident.outcome === "pending") {
      await updateIncident(incident.id, {
        outcome: "recovered",
        resolvedAt: new Date().toISOString(),
        resolvedBy: options.resolvedBy || "auto",
      });
    }
  }

  // 7. Full workflow completion
  const finalStatus = options?.isResume ? "healed" : "success";
  await updateRun(runId, {
    status: finalStatus,
    currentStep: null,
    finishedAt: new Date().toISOString(),
    stepOutputs,
  });
}

async function handleFailure(
  runId: string,
  step: StepDefinition,
  errorContext: Record<string, unknown>,
  currentIncidentCount: number,
  isResume?: boolean
): Promise<void> {
  const timestamp = new Date().toISOString();

  // If this was a resume attempt that failed again
  if (isResume) {
    const prevIncident = await getIncidentForRun(runId);
    if (prevIncident && prevIncident.outcome === "pending") {
      await updateIncident(prevIncident.id, {
        outcome: "failed",
        resolvedAt: timestamp,
      });
    }

    // If it failed on the SAME step again, stop and fail the run
    if (prevIncident && prevIncident.failedStep === step.name) {
      await updateRun(runId, {
        status: "failed",
        finishedAt: timestamp,
        incidentCount: currentIncidentCount + 1,
      });
      return;
    }
  }

  // Enforce hard cap: max 3 incidents per run
  if (currentIncidentCount >= 3) {
    await updateRun(runId, {
      status: "failed",
      finishedAt: timestamp,
      incidentCount: currentIncidentCount + 1,
    });
    return;
  }

  // Mark run as healing for this new incident
  await updateRun(runId, {
    status: "healing",
    incidentCount: currentIncidentCount + 1,
  });

  const incident = await createIncident({
    runId,
    failedStep: step.name,
    errorContext,
    riskLevel: "medium",
    decision: "pending",
    outcome: "pending",
    detectedAt: timestamp,
    createdAt: timestamp,
  });

  await onIncidentCreated(incident.id);
}

/**
 * Initializes a new workflow run in Firestore and starts execution.
 * Returns the created runId.
 */
export async function startRun(
  workflowName: string,
  inputPayload: Record<string, unknown>
): Promise<string> {
  const steps = getWorkflow(workflowName);

  const run = await createRun({
    workflowName,
    status: "running",
    inputPayload,
    currentStep: null,
    stepOutputs: {},
    configPatches: {},
    incidentCount: 1,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  });

  // Execute pipeline
  await executePipeline(run.id, inputPayload, steps, 0, {});

  return run.id;
}

/**
 * Re-executes a workflow run starting from a specific failed step,
 * utilizing previously cached step outputs and an optional patched StepConfig.
 */
export async function resumeRun(
  runId: string,
  fromStep: string,
  configPatch?: Partial<StepConfig>,
  resolvedBy: "auto" | "human" = "auto"
): Promise<void> {
  const run = await getRun(runId);
  if (!run) {
    throw new Error(`Run '${runId}' not found for resume.`);
  }

  const steps = getWorkflow(run.workflowName);
  const fromIndex = steps.findIndex((s) => s.name === fromStep);

  if (fromIndex === -1) {
    throw new Error(`Step '${fromStep}' not found in workflow '${run.workflowName}'.`);
  }

  // Load existing patches from run
  const existingPatches = (run.configPatches as Record<string, Partial<StepConfig>>) || {};
  const activePatch = { ...(existingPatches[fromStep] || {}), ...(configPatch || {}) };

  // Apply configuration patch to the targeted step
  steps[fromIndex].defaultConfig = {
    ...steps[fromIndex].defaultConfig,
    ...activePatch,
    fieldMapping: {
      ...(steps[fromIndex].defaultConfig.fieldMapping || {}),
      ...(activePatch.fieldMapping || {}),
    },
    coerceRules: {
      ...(steps[fromIndex].defaultConfig.coerceRules || {}),
      ...(activePatch.coerceRules || {}),
    },
  };

  // Persist updated patches on the run document
  existingPatches[fromStep] = activePatch;
  await updateRun(runId, {
    status: "healing",
    currentStep: fromStep,
    configPatches: existingPatches,
  });

  await executePipeline(
    runId,
    run.inputPayload,
    steps,
    fromIndex,
    (run.stepOutputs as Record<string, unknown>) || {},
    { isResume: true, resolvedBy }
  );
}
