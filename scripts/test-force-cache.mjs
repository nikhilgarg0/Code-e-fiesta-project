// scripts/test-force-cache.mjs
// Verifies DEMO_FORCE_CACHE=true triggers cache fallback and completes healing

const BASE_URL = "http://localhost:3000";

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=================================================");
  console.log("  Testing DEMO_FORCE_CACHE Offline Fallback       ");
  console.log("=================================================\n");

  // Reset system
  await fetch(`${BASE_URL}/api/reset`, { method: "POST" });
  await delay(1000);

  // Set chaos mode to schema_drift
  await fetch(`${BASE_URL}/api/chaos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "schema_drift" }),
  });

  // Temporarily set DEMO_FORCE_CACHE
  process.env.DEMO_FORCE_CACHE = "true";

  console.log("Triggering workflow run with schema_drift...");
  const res = await fetch(`${BASE_URL}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workflowName: "lead_to_crm",
      lead: { name: "Offline Demo Lead", email: "offline@test.com", company: "Cache Corp" },
    }),
  });

  const { runId } = await res.json();
  console.log(`Run started: #${runId}`);

  let healed = false;
  let source = "";

  for (let i = 0; i < 25; i++) {
    await delay(1000);
    const checkRes = await fetch(`${BASE_URL}/api/runs/${runId}`);
    const data = await checkRes.json();
    const run = data.run;
    const inc = data.incident;

    if (run && (run.status === "healed" || run.status === "failed")) {
      healed = run.status === "healed";
      source = inc?.diagnosis?.source || "";
      console.log(`Run completed with status '${run.status}', incident source: '${source}'`);
      break;
    }
  }

  // Reset
  await fetch(`${BASE_URL}/api/reset`, { method: "POST" });

  if (healed) {
    console.log(`\n✓ PASS: Run healed cleanly. Source: '${source}'`);
    process.exit(0);
  } else {
    console.error(`\n✗ FAIL: Run did not heal. Ended in non-healed state.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
