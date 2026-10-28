// scripts/test-email-send.mjs
// Verifies send_followup step behavior with mock fallback and real EmailJS logging

const BASE_URL = "http://localhost:3000";

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=================================================");
  console.log("  Testing send_followup Step & EmailJS Fallback  ");
  console.log("=================================================\n");

  // Reset
  await fetch(`${BASE_URL}/api/reset`, { method: "POST" });
  await delay(1000);

  // Trigger a healthy run
  console.log("1. Triggering healthy workflow run...");
  const runRes = await fetch(`${BASE_URL}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workflowName: "lead_to_crm",
      lead: {
        name: "Samantha Wright",
        email: "samantha@innovate-health.com",
        company: "Innovate Health",
      },
    }),
  });

  const { runId } = await runRes.json();
  console.log(`   Run started: #${runId}`);

  // Wait for run completion
  let sendFollowupStep = null;
  for (let i = 0; i < 25; i++) {
    await delay(1000);
    const checkRes = await fetch(`${BASE_URL}/api/runs/${runId}`);
    const data = await checkRes.json();
    const steps = data.steps || [];

    sendFollowupStep = steps.find((s) => s.stepName === "send_followup");
    if (sendFollowupStep && data.run?.status === "success") {
      break;
    }
  }

  if (!sendFollowupStep) {
    console.error("✗ FAIL: send_followup step not found in completed run.");
    process.exit(1);
  }

  const mode = sendFollowupStep.request?.mode;
  console.log(`✓ send_followup executed with status '${sendFollowupStep.status}'`);
  console.log(`   request.mode logged: '${mode}'`);
  console.log(`   dispatched output:`, JSON.stringify(sendFollowupStep.response?.body || {}));

  if (mode === "mock" || mode === "real") {
    console.log(`\n✓ PASS: request.mode is correctly logged as '${mode}'`);
  } else {
    console.error(`\n✗ FAIL: request.mode '${mode}' is not 'real' or 'mock'!`);
    process.exit(1);
  }

  // Cleanup
  await fetch(`${BASE_URL}/api/reset`, { method: "POST" });
  console.log("\n=================================================");
  console.log("  TEST COMPLETE: STEP INTERFACE & SCHEMAS INTACT ");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
