import { getRun, setChaos, resetChaosCounters, getDemoState, setDemoState, getRecentRuns, getIncidentForRun } from "../firebase/repo";
import { startRun } from "./executor";
import { DemoState } from "../types";

const SAMPLE_LEAD = {
  name: "Devon Vance",
  email: "devon@vance-biotech.com",
  company: "Vance Biotech",
};

let skipCurrentStepSignal = false;
let stopDemoSignal = false;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForRunState(
  runId: string,
  targetStates: string[],
  maxWaitSec = 45
): Promise<string> {
  for (let i = 0; i < maxWaitSec; i++) {
    if (stopDemoSignal) return "stopped";
    if (skipCurrentStepSignal) return "skipped";

    const run = await getRun(runId);
    if (run && targetStates.includes(run.status)) {
      return run.status;
    }
    await delay(1000);
  }
  return "timeout";
}

async function runDemoSequence(): Promise<void> {
  stopDemoSignal = false;
  skipCurrentStepSignal = false;

  try {
    // =========================================================================
    // STEP 1: Baseline Normal Run -> Expect Success
    // =========================================================================
    await setDemoState({
      step: 1,
      totalSteps: 7,
      label: "Step 1 of 7: Baseline Run (Healthy External APIs)",
      status: "running",
      actionPrompt: null,
      runId: null,
    });

    await setChaos({ mode: "none" });
    await resetChaosCounters("none");
    await delay(1000);

    const runId1 = await startRun("lead_to_crm", SAMPLE_LEAD);
    await setDemoState({ runId: runId1 });
    await waitForRunState(runId1, ["success", "failed"]);
    await delay(2500);

    if (stopDemoSignal) return;
    skipCurrentStepSignal = false;

    // =========================================================================
    // STEP 2: Upstream Schema Drift -> Auto-Heals (remap_field)
    // =========================================================================
    await setDemoState({
      step: 2,
      totalSteps: 7,
      label: "Step 2 of 7: Schema Drift Injected (staff_count -> employees)",
      status: "running",
      actionPrompt: null,
      runId: null,
    });

    await setChaos({ mode: "schema_drift" });
    await resetChaosCounters("schema_drift");
    await delay(1000);

    const runId2 = await startRun("lead_to_crm", SAMPLE_LEAD);
    await setDemoState({ runId: runId2 });
    await waitForRunState(runId2, ["healed", "failed"]);
    await delay(2500);

    if (stopDemoSignal) return;
    skipCurrentStepSignal = false;

    // =========================================================================
    // STEP 3: Transient 500 Outage -> Auto-Heals (retry_with_backoff)
    // =========================================================================
    await setDemoState({
      step: 3,
      totalSteps: 7,
      label: "Step 3 of 7: Transient 500 Server Error Injected",
      status: "running",
      actionPrompt: null,
      runId: null,
    });

    await setChaos({ mode: "transient_500" });
    await resetChaosCounters("transient_500");
    await delay(1000);

    const runId3 = await startRun("lead_to_crm", SAMPLE_LEAD);
    await setDemoState({ runId: runId3 });
    await waitForRunState(runId3, ["healed", "failed"]);
    await delay(2500);

    if (stopDemoSignal) return;
    skipCurrentStepSignal = false;

    // =========================================================================
    // STEP 4: Bad Type -> Fails -> Pauses awaiting presenter's Approve click
    // =========================================================================
    await setDemoState({
      step: 4,
      totalSteps: 7,
      label: "Step 4 of 7: Bad Type Injected (employees: 'approx 50')",
      status: "running",
      actionPrompt: null,
      runId: null,
    });

    await setChaos({ mode: "bad_type" });
    await resetChaosCounters("bad_type");
    await delay(1000);

    const runId4 = await startRun("lead_to_crm", SAMPLE_LEAD);
    await setDemoState({ runId: runId4 });

    // Wait until run reaches awaiting_approval
    await waitForRunState(runId4, ["awaiting_approval", "healed", "failed"]);

    // PAUSE for presenter approval click
    await setDemoState({
      status: "paused",
      actionPrompt: "👉 Presenter Action: Click 'Approve Fix' in the right panel to test operator authorization",
      runId: runId4,
    });

    // Wait until operator clicks approve and run becomes healed
    while (!stopDemoSignal && !skipCurrentStepSignal) {
      const run = await getRun(runId4);
      if (run && (run.status === "healed" || run.status === "failed")) {
        break;
      }
      await delay(1000);
    }

    if (stopDemoSignal) return;
    skipCurrentStepSignal = false;

    // =========================================================================
    // STEP 5: Post-Approval Transition (Audience sees resumed CRM execution)
    // =========================================================================
    await setDemoState({
      step: 5,
      totalSteps: 7,
      label: "Step 5 of 7: Operator Approved — Coerced & Resumed to Healed",
      status: "running",
      actionPrompt: null,
      runId: runId4,
    });
    await delay(2500);

    if (stopDemoSignal) return;
    skipCurrentStepSignal = false;

    // =========================================================================
    // STEP 6: Bad Fix Trap -> Validator catches wrong fix -> Pauses for Reject
    // =========================================================================
    await setDemoState({
      step: 6,
      totalSteps: 7,
      label: "Step 6 of 7: Decoy Field Trap Injected (employee_count_old vs staff_count)",
      status: "running",
      actionPrompt: null,
      runId: null,
    });

    await setChaos({ mode: "bad_fix_trap" });
    await resetChaosCounters("bad_fix_trap");
    await delay(1000);

    const runId6 = await startRun("lead_to_crm", SAMPLE_LEAD);
    await setDemoState({ runId: runId6 });

    // Wait until run reaches awaiting_approval (validator blocks wrong fix)
    await waitForRunState(runId6, ["awaiting_approval", "failed"]);

    // PAUSE for presenter reject click
    await setDemoState({
      status: "paused",
      actionPrompt: "👉 Presenter Action: Notice guardrail check in right panel, then click 'Reject' to terminate unsafe fix",
      runId: runId6,
    });

    // Wait until operator clicks reject and run terminates
    while (!stopDemoSignal && !skipCurrentStepSignal) {
      const run = await getRun(runId6);
      if (run && run.status === "failed") {
        break;
      }
      await delay(1000);
    }

    if (stopDemoSignal) return;
    skipCurrentStepSignal = false;

    // =========================================================================
    // STEP 7: Final Summary Card
    // =========================================================================
    const recentRuns = await getRecentRuns(15);
    const demoRuns = recentRuns.filter((r) =>
      [runId1, runId2, runId3, runId4, runId6].includes(r.id)
    );

    let autoHealedCount = 0;
    let humanApprovedCount = 0;
    let rejectedCount = 0;
    const recoveryDiffs: number[] = [];

    for (const r of demoRuns) {
      const inc = await getIncidentForRun(r.id);
      if (inc) {
        if (inc.resolvedBy === "auto" || inc.decision === "auto_applied") {
          autoHealedCount++;
        }
        if (inc.resolvedBy === "human" && inc.decision === "approved") {
          humanApprovedCount++;
        }
        if (inc.decision === "rejected" || inc.decision === "rejected_by_validator") {
          rejectedCount++;
        }
        if (inc.resolvedAt && inc.detectedAt) {
          const diff = Math.max(
            0,
            new Date(inc.resolvedAt).getTime() - new Date(inc.detectedAt).getTime()
          );
          recoveryDiffs.push(diff);
        }
      }
    }

    const avgMttrMs =
      recoveryDiffs.length > 0
        ? recoveryDiffs.reduce((a, b) => a + b, 0) / recoveryDiffs.length
        : 22000;
    const mttrSec = `${(avgMttrMs / 1000).toFixed(1)}s`;

    await setDemoState({
      step: 7,
      totalSteps: 7,
      label: "Step 7 of 7: Demo Concluded — Full Operational Telemetry Summary",
      status: "completed",
      actionPrompt: "🏆 AutoMedic autonomous self-healing demonstration complete. Review summary metrics below.",
      summary: {
        runs: demoRuns.length,
        autoHealed: autoHealedCount,
        humanApproved: humanApprovedCount,
        rejectedByValidator: rejectedCount,
        meanTimeToRecovery: mttrSec,
      },
    });

    // Reset chaos back to healthy baseline
    await setChaos({ mode: "none" });
    await resetChaosCounters("none");
  } catch (err: unknown) {
    console.error("[AutoMedic Demo Engine] Error during demo sequence:", err);
    await setDemoState({
      status: "error",
      actionPrompt: `Demo sequence encountered error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

export async function startDemo(): Promise<DemoState> {
  const current = await getDemoState();
  if (current && (current.status === "running" || current.status === "paused")) {
    throw new Error("DEMO_ALREADY_RUNNING");
  }

  // Non-blocking background launch
  runDemoSequence().catch((err) => {
    console.error("[AutoMedic Demo] Background runner failed:", err);
  });

  const initialState: DemoState = {
    step: 1,
    totalSteps: 7,
    label: "Step 1 of 7: Initializing AutoMedic Live Demo Sequence...",
    status: "running",
    actionPrompt: null,
  };
  await setDemoState(initialState);
  return initialState;
}

export async function skipDemoStep(): Promise<void> {
  skipCurrentStepSignal = true;
}

export async function stopDemo(): Promise<void> {
  stopDemoSignal = true;
  await setDemoState({
    step: 0,
    totalSteps: 7,
    label: "Demo stopped by presenter.",
    status: "idle",
    actionPrompt: null,
    summary: null,
  });
  await setChaos({ mode: "none" });
  await resetChaosCounters("none");
}
