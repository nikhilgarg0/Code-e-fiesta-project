const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function setChaosMode(mode) {
  const res = await fetch(`${BASE_URL}/api/chaos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to set chaos mode to '${mode}': ${text}`);
  }
  return res.json();
}

async function startWorkflowRun() {
  const res = await fetch(`${BASE_URL}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workflowName: "lead_to_crm",
      lead: {
        name: "Jane Doe",
        email: "jane@acme.com",
        company: "Acme Corp",
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to start run: ${text}`);
  }
  return res.json();
}

async function getRunDetails(runId) {
  const res = await fetch(`${BASE_URL}/api/runs/${runId}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch run '${runId}': ${text}`);
  }
  return res.json();
}

const MODES = [
  { mode: "none", expectedStatus: "success", expectedFailedStep: null },
  { mode: "schema_drift", expectedStatus: "failed", expectedFailedStep: "enrich_company" },
  { mode: "transient_500", expectedStatus: "failed", expectedFailedStep: "enrich_company" },
  { mode: "rate_limit", expectedStatus: "failed", expectedFailedStep: "save_to_crm" },
  { mode: "bad_type", expectedStatus: "failed", expectedFailedStep: "enrich_company" },
  { mode: "primary_down", expectedStatus: "failed", expectedFailedStep: "enrich_company" },
  { mode: "bad_fix_trap", expectedStatus: "failed", expectedFailedStep: "enrich_company" },
];

async function run() {
  console.log(`\n========================================================================`);
  console.log(`🛡️  AutoMedic Workflow Executor: Failure & Incident Detection Test Suite`);
  console.log(`========================================================================`);
  console.log(`Target: ${BASE_URL}\n`);

  const results = [];
  let allPassed = true;

  for (const { mode, expectedStatus, expectedFailedStep } of MODES) {
    process.stdout.write(`Executing mode: [${mode.padEnd(14)}] ... `);

    // 1. Reset chaos counters and set active mode
    await setChaosMode(mode);

    // 2. Start workflow run
    const { runId } = await startWorkflowRun();

    // 3. Fetch run details
    const details = await getRunDetails(runId);
    const { run, incident } = details;

    const failedStep = incident?.failedStep || run.currentStep || "-";
    const errorCode = incident?.errorContext?.errorCode || "-";
    const hasIncident = !!incident;

    // Verify expectations
    const statusMatch = run.status === expectedStatus;
    const stepMatch = expectedFailedStep ? failedStep === expectedFailedStep : failedStep === "-";
    const incidentMatch = expectedStatus === "failed" ? hasIncident : !hasIncident;
    const passed = statusMatch && stepMatch && incidentMatch;

    if (!passed) {
      allPassed = false;
      console.log(`❌ FAILED`);
    } else {
      console.log(`✓ PASSED`);
    }

    results.push({
      "Chaos Mode": mode,
      "Run Status": run.status,
      "Failed Step": failedStep,
      "Error Code": errorCode,
      "Incident Created": hasIncident ? "Yes" : "No",
      "Expected Step": expectedFailedStep || "-",
      "Result": passed ? "PASS" : "FAIL",
    });
  }

  // Restore chaos mode to 'none'
  await setChaosMode("none");

  console.log(`\n============================= RESULTS TABLE =============================`);
  console.table(results);
  console.log(`=========================================================================\n`);

  if (!allPassed) {
    console.error("❌ Some executor tests failed to match expectations.");
    process.exit(1);
  }

  console.log("🎉 ALL EXECUTOR RUNS AND INCIDENT DETECTIONS PASSED AS EXPECTED!\n");
}

run().catch((err) => {
  console.error("Test execution encountered an unhandled error:", err);
  process.exit(1);
});
