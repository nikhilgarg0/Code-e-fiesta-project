const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// =========================================================================
// UNIT TESTS FOR DECISION POLICY
// =========================================================================

async function runPolicyUnitTests() {
  console.log(`\n========================================================================`);
  console.log(`🧪 Running Unit Tests for Decision Policy decide()...`);
  console.log(`========================================================================`);

  const { decide, MIN_AUTO_CONFIDENCE, ALLOWED_AUTO_RISK_LEVEL } = await import("../lib/engine/policy.ts");

  function assert(condition, desc) {
    if (!condition) {
      console.error(`❌ Unit test assertion failed: ${desc}`);
      process.exit(1);
    }
    console.log(`  ✓ ${desc}`);
  }

  // Branch 1: validation.valid === false -> rejected_by_validator
  const res1 = decide(
    { riskLevel: "low", confidence: 0.95 },
    { valid: false, requiresApproval: false, checks: [], validatedAt: "" }
  );
  assert(res1 === "rejected_by_validator", "Invalid validation -> rejected_by_validator");

  // Branch 2: low risk, high confidence, valid, !requiresApproval -> auto_applied
  const res2 = decide(
    { riskLevel: ALLOWED_AUTO_RISK_LEVEL, confidence: MIN_AUTO_CONFIDENCE },
    { valid: true, requiresApproval: false, checks: [], validatedAt: "" }
  );
  assert(res2 === "auto_applied", "Low risk, confidence >= 0.8, valid, !requiresApproval -> auto_applied");

  // Branch 3: confidence < 0.8 -> pending
  const res3 = decide(
    { riskLevel: "low", confidence: 0.79 },
    { valid: true, requiresApproval: false, checks: [], validatedAt: "" }
  );
  assert(res3 === "pending", "Confidence < 0.8 -> pending (escalates to human)");

  // Branch 4: riskLevel medium -> pending
  const res4 = decide(
    { riskLevel: "medium", confidence: 0.99 },
    { valid: true, requiresApproval: false, checks: [], validatedAt: "" }
  );
  assert(res4 === "pending", "Risk medium -> pending");

  // Branch 5: riskLevel high -> pending
  const res5 = decide(
    { riskLevel: "high", confidence: 0.99 },
    { valid: true, requiresApproval: false, checks: [], validatedAt: "" }
  );
  assert(res5 === "pending", "Risk high -> pending");

  // Branch 6: validation.requiresApproval === true -> pending
  const res6 = decide(
    { riskLevel: "low", confidence: 0.95 },
    { valid: true, requiresApproval: true, checks: [], validatedAt: "" }
  );
  assert(res6 === "pending", "Requires human approval -> pending");

  console.log(`🎉 All 6 decision policy unit tests passed successfully!\n`);
}

// =========================================================================
// INTEGRATION TESTS FOR FULL SELF-HEALING PIPELINE
// =========================================================================

async function setChaosMode(mode) {
  const res = await fetch(`${BASE_URL}/api/chaos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(`Failed to set chaos mode '${mode}'`);
  return res.json();
}

async function startWorkflowRun() {
  const res = await fetch(`${BASE_URL}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workflowName: "lead_to_crm",
      lead: {
        name: "Devon Vance",
        email: "devon@vance-biotech.com",
        company: "Vance Biotech",
      },
    }),
  });
  if (!res.ok) throw new Error("Failed to start workflow run");
  return res.json();
}

async function getRunDetails(runId) {
  const res = await fetch(`${BASE_URL}/api/runs/${runId}`);
  if (!res.ok) throw new Error(`Failed to fetch run '${runId}'`);
  return res.json();
}

async function approveIncident(incidentId) {
  const res = await fetch(`${BASE_URL}/api/incidents/${incidentId}/approve`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to approve incident '${incidentId}': ${text}`);
  }
  return res.json();
}

async function rejectIncident(incidentId) {
  const res = await fetch(`${BASE_URL}/api/incidents/${incidentId}/reject`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to reject incident '${incidentId}': ${text}`);
  }
  return res.json();
}

async function pollUntilState(runId, terminalStates, timeoutMs = 60000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const details = await getRunDetails(runId);
    if (terminalStates.includes(details.run.status)) {
      return details;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Run '${runId}' did not reach one of [${terminalStates.join(", ")}] within ${timeoutMs}ms.`);
}

const MODES_CONFIG = [
  { mode: "none", expectedFinalStatus: "success", expectedDecision: "-", expectedResolvedBy: "-" },
  { mode: "schema_drift", expectedFinalStatus: "healed", expectedDecision: "auto_applied", expectedResolvedBy: "auto" },
  { mode: "transient_500", expectedFinalStatus: "healed", expectedDecision: "auto_applied", expectedResolvedBy: "auto" },
  { mode: "rate_limit", expectedFinalStatus: "healed", expectedDecision: "auto_applied", expectedResolvedBy: "auto" },
  { mode: "primary_down", expectedFinalStatus: "healed", expectedDecision: "auto_applied", expectedResolvedBy: "auto" },
  { mode: "bad_type", expectedFinalStatus: "healed", expectedDecision: "approved", expectedResolvedBy: "human" },
  { mode: "bad_fix_trap", expectedFinalStatus: "failed", expectedDecision: "rejected", expectedResolvedBy: "human" },
];

async function run() {
  // 1. Run pure policy unit tests first
  await runPolicyUnitTests();

  console.log(`========================================================================`);
  console.log(`🏥 AutoMedic End-to-End Self-Healing Test Suite`);
  console.log(`========================================================================`);
  console.log(`Target: ${BASE_URL}\n`);

  const summaryRows = [];
  let anyMismatch = false;

  for (const cfg of MODES_CONFIG) {
    const mode = cfg.mode;
    process.stdout.write(`▶ Mode: [${mode.padEnd(14)}] ... `);

    // Reset chaos and set active mode
    await setChaosMode(mode);

    // Start workflow run
    const { runId } = await startWorkflowRun();

    // Poll until run reaches awaiting_approval, success, healed, or failed
    let details = await pollUntilState(runId, ["success", "healed", "failed", "awaiting_approval"]);
    let run = details.run;
    let incident = details.incident;

    // Handle human-in-the-loop actions for modes awaiting approval
    if (run.status === "awaiting_approval" && incident) {
      if (mode === "bad_type") {
        process.stdout.write(`(Awaiting Approval -> Calling /approve) ... `);
        await approveIncident(incident.id);
        details = await pollUntilState(runId, ["healed", "failed"]);
      } else if (mode === "bad_fix_trap") {
        process.stdout.write(`(Escalated -> Calling /reject) ... `);
        await rejectIncident(incident.id);
        details = await pollUntilState(runId, ["healed", "failed"]);
      }
      run = details.run;
      incident = details.incident;
    }

    // Refresh to ensure latest incident outcome and timestamps
    const finalDetails = await getRunDetails(runId);
    run = finalDetails.run;
    incident = finalDetails.incident;

    const finalStatus = run.status;
    const decision = incident?.decision || "-";
    const fixType = incident?.proposedFix?.type || incident?.diagnosis?.proposedFix?.type || "-";
    const confidence = incident?.diagnosis?.confidence != null ? Number(incident.diagnosis.confidence).toFixed(2) : "-";
    const risk = incident?.riskLevel || incident?.diagnosis?.riskLevel || "-";
    const resolvedBy = incident?.resolvedBy || "-";

    // Compute recovery duration
    let secToRecover = "-";
    if (incident?.resolvedAt && incident?.detectedAt) {
      const diffMs = new Date(incident.resolvedAt).getTime() - new Date(incident.detectedAt).getTime();
      secToRecover = (diffMs / 1000).toFixed(1) + "s";
    }

    const matchesExpected =
      finalStatus === cfg.expectedFinalStatus &&
      (cfg.expectedDecision === "-" || decision === cfg.expectedDecision) &&
      (cfg.expectedResolvedBy === "-" || resolvedBy === cfg.expectedResolvedBy);

    if (!matchesExpected) {
      anyMismatch = true;
      console.log(`❌ MISMATCH (Expected: ${cfg.expectedFinalStatus}, Got: ${finalStatus})`);
    } else {
      console.log(`✓ ${finalStatus.toUpperCase()} (${decision})`);
    }

    summaryRows.push({
      "Chaos Mode": mode,
      "Expected": cfg.expectedFinalStatus,
      "Actual Status": finalStatus,
      "Decision": decision,
      "Fix Type": fixType,
      "Conf": confidence,
      "Risk": risk,
      "Resolved By": resolvedBy,
      "Recovery Time": secToRecover,
      "Match": matchesExpected ? "PASS" : "FLAG",
    });

    await new Promise((r) => setTimeout(r, 1000));
  }

  // Restore chaos to 'none'
  await setChaosMode("none");

  console.log(`\n================================ END-TO-END HEALING RESULTS ================================`);
  console.table(summaryRows);
  console.log(`============================================================================================\n`);

  if (anyMismatch) {
    console.error("⚠️  Some modes did not match expectations.");
    process.exit(1);
  }

  console.log("🎉 ALL MODES MATCHED EXPECTED SELF-HEALING & APPROVAL OUTCOMES PERFECTLY!\n");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
