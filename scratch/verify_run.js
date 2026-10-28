// scratch/verify_run.js
const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function main() {
  console.log("=== STEP 1: Set Chaos to 'none' ===");
  const chaosRes = await fetch(`${BASE_URL}/api/chaos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "none" }),
  });
  console.log("Chaos set status:", chaosRes.status, await chaosRes.json());

  console.log("\n=== STEP 2: Trigger Lead via Webhook (as from /lead) ===");
  const leadRes = await fetch(`${BASE_URL}/api/webhooks/lead`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": "automedic-secret-key",
    },
    body: JSON.stringify({
      name: "Devon Vance",
      email: "devon@vance-biotech.com",
      company: "Vance Biotech",
      website: "https://vance-biotech.com",
    }),
  });

  const leadData = await leadRes.json();
  console.log("Lead webhook response:", leadData);
  const runId = leadData.runId;

  if (!runId) {
    console.error("No runId returned!");
    return;
  }

  console.log(`\n=== STEP 3: Await Workflow Completion for Run: ${runId} ===`);
  let runData;
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const rRes = await fetch(`${BASE_URL}/api/runs/${runId}`);
    const data = await rRes.json();
    const run = data.run;
    const steps = data.steps || [];
    console.log(`Polling status [${i + 1}s]:`, run?.status, `(${steps.length} steps logged)`);
    if (run && (run.status === "success" || run.status === "healed" || run.status === "failed" || run.status === "awaiting_approval")) {
      runData = data;
      break;
    }

  }

  if (!runData) {
    console.error("Timeout waiting for run completion!");
    return;
  }

  console.log(`\n=== STEP 4: Final Run Status: ${runData.run.status} ===`);
  console.log("Steps Telemetry & Modes:");
  for (const step of runData.steps || []) {
    console.log({
      stepName: step.stepName,
      status: step.status,
      durationMs: step.durationMs,
      requestMode: step.request?.mode,
      outputSummary: step.output ? Object.keys(step.output) : null,
      error: step.error,
    });
  }

  console.log("\nFull Output of send_followup step:");
  const emailStep = (runData.steps || []).find((s) => s.stepName === "send_followup");
  console.log(JSON.stringify(emailStep, null, 2));
}


main().catch(console.error);
