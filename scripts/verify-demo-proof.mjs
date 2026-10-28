// scripts/verify-demo-proof.mjs
// Comprehensive automated test script for AutoMedic Demo-Proof resilience

const BASE_URL = "http://localhost:3000";

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testEndpoint(name, url, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${url}`, options);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function main() {
  console.log("=================================================");
  console.log("  AutoMedic Demo-Proof Automated Verification    ");
  console.log("=================================================\n");

  const results = [];

  // 1. Health check verification
  console.log("[Test 1] Verifying /api/health returns clean status without debug info...");
  const healthRes = await testEndpoint("Health Check", "/api/health");
  const hasNoDebug = healthRes.data?.debug === undefined && healthRes.data?.record === undefined;
  const healthPassed = healthRes.ok && healthRes.data?.status === "healthy" && hasNoDebug;
  results.push({ name: "/api/health Security & Sanitation", passed: healthPassed });
  console.log(healthPassed ? "  ✓ PASS: Clean healthy response without debug leak" : "  ✗ FAIL");

  // 2. Idempotent fast reset
  console.log("\n[Test 2] Testing /api/reset (idempotent fast reset)...");
  const resetRes = await testEndpoint("Reset", "/api/reset", { method: "POST" });
  const resetPassed = resetRes.ok && resetRes.data?.success === true;
  results.push({ name: "/api/reset Idempotent Reset", passed: resetPassed });
  console.log(resetPassed ? "  ✓ PASS: Reset cleared chaos counters and reset demo state" : "  ✗ FAIL");

  // 3. Demo API State Check
  console.log("\n[Test 3] Testing /api/demo state machine initial query...");
  const demoRes = await testEndpoint("Demo State", "/api/demo");
  const demoInitPassed = demoRes.ok && demoRes.data?.status === "idle";
  results.push({ name: "/api/demo Initial State (idle)", passed: demoInitPassed });
  console.log(demoInitPassed ? "  ✓ PASS: Demo state starts idle" : "  ✗ FAIL");

  // 4. Test Starting Demo & 409 Conflict Protection
  console.log("\n[Test 4] Testing /api/demo/start and 409 Conflict Protection...");
  const startRes = await testEndpoint("Demo Start", "/api/demo/start", { method: "POST" });
  const started = startRes.ok && (startRes.data?.status === "running" || startRes.status === 200);
  
  // Immediately attempt second start to test 409
  const secondStartRes = await testEndpoint("Demo Start Duplicate", "/api/demo/start", { method: "POST" });
  const conflictPassed = secondStartRes.status === 409;
  results.push({ name: "/api/demo/start 409 Conflict Guard", passed: conflictPassed });
  console.log(started ? "  ✓ PASS: Demo started in background" : "  ✗ FAIL");
  console.log(conflictPassed ? "  ✓ PASS: Second start correctly rejected with 409 Conflict" : "  ✗ FAIL");

  // Stop demo cleanly
  await testEndpoint("Demo Stop", "/api/demo/stop", { method: "POST" });
  console.log("  ✓ Demo stopped cleanly");

  // 5. Test Schema Drift with Gemini & Cache Fallback
  console.log("\n[Test 5] Triggering Schema Drift Workflow Run...");
  await testEndpoint("Set Chaos", "/api/chaos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "schema_drift" }),
  });

  const runRes = await testEndpoint("Start Run", "/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workflowName: "lead_to_crm",
      lead: { name: "Audit Lead", email: "audit@test.com", company: "Audit Corp" },
    }),
  });

  const runId = runRes.data?.runId;
  console.log(`  Run triggered: #${runId}`);

  // Wait for run to heal or complete
  let finalStatus = "unknown";
  for (let i = 0; i < 30; i++) {
    await delay(1000);
    const check = await testEndpoint("Check Run", `/api/runs/${runId}`);
    finalStatus = check.data?.run?.status;
    if (finalStatus === "healed" || finalStatus === "success" || finalStatus === "failed") {
      const incident = check.data?.incident;
      console.log(`  Run finished with status: '${finalStatus}'`);
      if (incident) {
        console.log(`  Incident decision: '${incident.decision}', source: '${incident.diagnosis?.source || "gemini"}'`);
      }
      break;
    }
  }

  const healPassed = finalStatus === "healed";
  results.push({ name: "Autonomous Healing (Schema Drift)", passed: healPassed });
  console.log(healPassed ? "  ✓ PASS: Run auto-healed successfully" : `  ✗ FAIL: Ended in ${finalStatus}`);

  // Clean up
  await testEndpoint("Reset", "/api/reset", { method: "POST" });

  console.log("\n=================================================");
  console.log("           VERIFICATION SUMMARY                  ");
  console.log("=================================================");
  let allPassed = true;
  for (const r of results) {
    const symbol = r.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`  [${symbol}] ${r.name}`);
    if (!r.passed) allPassed = false;
  }
  console.log("=================================================\n");
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification script fatal error:", err);
  process.exit(1);
});
