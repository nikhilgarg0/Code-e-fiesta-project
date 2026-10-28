const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function setChaosMode(mode) {
  const res = await fetch(`${BASE_URL}/api/chaos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to set chaos mode '${mode}': ${text}`);
  }
  return res.json();
}

async function triggerFailedRun() {
  const res = await fetch(`${BASE_URL}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workflowName: "lead_to_crm",
      lead: {
        name: "Alice Johnson",
        email: "alice@technova.io",
        company: "TechNova Systems",
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to trigger workflow run: ${text}`);
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

async function diagnoseIncident(incidentId) {
  const res = await fetch(`${BASE_URL}/api/incidents/${incidentId}/diagnose`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to diagnose incident '${incidentId}': ${text}`);
  }
  return res.json();
}

const FAILING_MODES = [
  "schema_drift",
  "transient_500",
  "rate_limit",
  "bad_type",
  "primary_down",
  "bad_fix_trap",
];

async function run() {
  console.log(`\n========================================================================================`);
  console.log(`🧠 AutoMedic AI Diagnosis Agent (Gemini) Evaluation Suite`);
  console.log(`========================================================================================`);
  console.log(`Target Service: ${BASE_URL}\n`);

  const tableRows = [];
  const detailedEvidenceList = [];

  for (const mode of FAILING_MODES) {
    console.log(`▶ Testing mode: [${mode}] ...`);

    // 1. Set chaos mode and reset counters
    await setChaosMode(mode);

    // 2. Start a workflow run to generate the failure & incident
    const { runId } = await triggerFailedRun();

    // 3. Retrieve run and associated incident
    const runDetails = await getRunDetails(runId);
    if (!runDetails.incident) {
      throw new Error(`Expected an incident for mode '${mode}', but none was created.`);
    }

    const incidentId = runDetails.incident.id;
    console.log(`  Incident generated: ${incidentId} on step '${runDetails.incident.failedStep}'`);

    // 4. Request AI Diagnosis via Gemini
    console.log(`  Invoking Gemini SRE Diagnosis...`);
    const diagnosis = await diagnoseIncident(incidentId);

    tableRows.push({
      "Chaos Mode": mode,
      "Failure Category": diagnosis.failureCategory,
      "Fix Type": diagnosis.proposedFix.type,
      "Fix Params": JSON.stringify(diagnosis.proposedFix.params),
      "Confidence": Number(diagnosis.confidence).toFixed(2),
      "Risk Level": diagnosis.riskLevel,
    });

    detailedEvidenceList.push({
      mode,
      incidentId,
      rootCause: diagnosis.rootCause,
      fixType: diagnosis.proposedFix.type,
      fixExplanation: diagnosis.proposedFix.explanation,
      params: diagnosis.proposedFix.params,
      confidence: diagnosis.confidence,
      riskLevel: diagnosis.riskLevel,
      evidence: diagnosis.evidence,
      alternativesConsidered: diagnosis.alternativesConsidered,
    });

    console.log(`  ✓ Diagnosis complete: [${diagnosis.failureCategory}] -> ${diagnosis.proposedFix.type}\n`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Restore chaos to 'none'
  await setChaosMode("none");

  // Print Summary Table
  console.log(`\n=================================== DIAGNOSIS SUMMARY TABLE ===================================`);
  console.table(tableRows);
  console.log(`===============================================================================================\n`);

  // Print Detailed Evidence & Reasoning
  console.log(`=================================== DETAILED AI EVIDENCE LOG ===================================\n`);
  for (const item of detailedEvidenceList) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`🔍 MODE: [${item.mode.toUpperCase()}]`);
    console.log(`- Incident ID: ${item.incidentId}`);
    console.log(`- Root Cause: ${item.rootCause}`);
    console.log(`- Proposed Fix: ${item.fixType} (Risk: ${item.riskLevel}, Confidence: ${item.confidence})`);
    console.log(`- Parameters: ${JSON.stringify(item.params)}`);
    console.log(`- Explanation: ${item.fixExplanation}`);
    console.log(`- Concrete Evidence Quoted:`);
    for (const ev of item.evidence) {
      console.log(`    • "${ev}"`);
    }
    if (item.alternativesConsidered && item.alternativesConsidered.length > 0) {
      console.log(`- Alternatives Considered:`);
      for (const alt of item.alternativesConsidered) {
        console.log(`    • ${alt}`);
      }
    }
    console.log(``);
  }

  console.log(`================================================================================`);
  console.log(`🎉 ALL 6 INCIDENTS DIAGNOSED WITH VALIDATED STRUCTURED GEMINI OUTPUTS!\n`);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
