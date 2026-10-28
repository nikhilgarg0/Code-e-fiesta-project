// scratch/test_all_scenarios.js
const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function testMode(modeName) {
  console.log(`\n========================================`);
  console.log(`Testing Mode: ${modeName}`);
  console.log(`========================================`);

  await fetch(`${BASE_URL}/api/chaos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: modeName }),
  });

  const leadRes = await fetch(`${BASE_URL}/api/webhooks/lead`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": "automedic-secret-key",
    },
    body: JSON.stringify({
      name: `Test Lead (${modeName})`,
      email: `lead_${modeName}@testcorp.io`,
      company: `${modeName} Enterprises`,
    }),
  });

  const { runId } = await leadRes.json();
  console.log(`Run started: ${runId}`);

  let finalRun;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const rRes = await fetch(`${BASE_URL}/api/runs/${runId}`);
    const data = await rRes.json();
    const run = data.run;
    if (run && ["success", "healed", "failed", "awaiting_approval"].includes(run.status)) {
      finalRun = data;
      break;
    }
  }

  if (finalRun) {
    console.log(`Result: status=${finalRun.run.status}, steps=${finalRun.steps?.length}, incidentDecision=${finalRun.incident?.decision || "none"}`);
  } else {
    console.log(`Result: Timed out waiting for final status`);
  }
}

async function main() {
  await testMode("none");
  await testMode("schema_drift");
  await testMode("transient_500");
  await testMode("bad_type");
  await testMode("primary_down");
  await testMode("bad_fix_trap");

  // Reset to none
  await fetch(`${BASE_URL}/api/chaos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "none" }),
  });
  console.log("\nFinished all scenario tests! Reset chaos to 'none'.");
}

main().catch(console.error);
