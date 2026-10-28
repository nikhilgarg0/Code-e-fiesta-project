// scratch/verify_schema_drift.js
const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function main() {
  console.log("=================================================");
  console.log("=== TEST: Schema Drift Fault Injection & Healing =");
  console.log("=================================================");

  console.log("\n1. Setting Chaos Mode to 'schema_drift'...");
  const chaosRes = await fetch(`${BASE_URL}/api/chaos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "schema_drift" }),
  });
  console.log("Chaos API Response:", await chaosRes.json());

  console.log("\n2. Triggering Lead Run via Webhook (from /lead)...");
  const leadRes = await fetch(`${BASE_URL}/api/webhooks/lead`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": "automedic-secret-key",
    },
    body: JSON.stringify({
      name: "Marcus Brody",
      email: "marcus@brody-robotics.com",
      company: "Brody Robotics",
      website: "https://brody-robotics.com",
    }),
  });

  const leadData = await leadRes.json();
  const runId = leadData.runId;
  console.log("Run started with ID:", runId);

  console.log("\n3. Monitoring Autonomous Healing Sequence...");
  let runData;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const rRes = await fetch(`${BASE_URL}/api/runs/${runId}`);
    const data = await rRes.json();
    const run = data.run;
    const steps = data.steps || [];
    const latestStep = steps[steps.length - 1]?.stepName;
    console.log(`[${i + 1}s] Status: ${run?.status} | Total steps: ${steps.length} | Latest: ${latestStep}`);

    if (run && (run.status === "healed" || run.status === "success" || run.status === "failed" || run.status === "awaiting_approval")) {
      runData = data;
      break;
    }
  }

  if (!runData) {
    console.error("Timeout waiting for run resolution!");
    return;
  }

  console.log("\n=================================================");
  console.log(`=== RUN RESOLUTION: ${runData.run.status.toUpperCase()} ===`);
  console.log("=================================================");

  console.log("\n--- Complete Steps Timeline ---");
  for (const step of runData.steps || []) {
    console.log({
      stepName: step.stepName,
      status: step.status,
      durationMs: step.durationMs,
      requestMode: step.request?.mode,
      error: step.error?.message,
    });
  }

  console.log("\n--- Incident & Autonomous Healing Telemetry ---");
  const inc = runData.incident;
  if (inc) {
    console.log("Incident ID:", inc.id);
    console.log("Failed Step:", inc.failedStep);
    console.log("Error Message:", inc.errorContext?.errorMessage);
    console.log("Captured Raw Response Body (Proxy Mutated):", inc.errorContext?.response?.body);
    console.log("Gemini Diagnosis Root Cause:", inc.diagnosis?.rootCause);
    console.log("Proposed Fix:", inc.proposedFix);
    console.log("Fix Validator Passed?:", inc.validationResult?.valid);
    console.log("Validator Checks:", inc.validationResult?.checks);
    console.log("Autonomous Policy Decision:", inc.decision);
    console.log("Final Incident Outcome:", inc.outcome);
  } else {
    console.log("No incident recorded on run doc.");
  }
}

main().catch(console.error);
