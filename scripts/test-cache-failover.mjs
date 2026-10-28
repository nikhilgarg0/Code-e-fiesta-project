// scripts/test-cache-failover.mjs
// Tests the Gemini cache fallback under offline and invalid API key conditions

import { getCachedDiagnosis } from "../lib/ai/cache.ts";
import { DiagnosisSchema } from "../lib/types.ts";

console.log("=================================================");
console.log("  Testing Gemini Fallback Cache & Validation     ");
console.log("=================================================\n");

const modes = [
  "schema_drift",
  "transient_500",
  "rate_limit",
  "bad_type",
  "primary_down",
  "bad_fix_trap",
];

let allValid = true;

for (const mode of modes) {
  try {
    const diag = getCachedDiagnosis(mode);
    const parsed = DiagnosisSchema.safeParse(diag);
    if (!parsed.success) {
      console.error(`✗ Mode '${mode}' failed DiagnosisSchema validation:`, parsed.error.issues);
      allValid = false;
    } else {
      console.log(`✓ Mode '${mode}': Valid cache entry`);
      console.log(`   Fix Type: ${diag.proposedFix.type}`);
      console.log(`   Risk Level: ${diag.riskLevel}`);
      console.log(`   Source: ${diag.source}`);
      console.log(`   Evidence Quote: "${(diag.evidence[0] || '').slice(0, 50)}..."`);
    }
  } catch (err) {
    console.error(`✗ Mode '${mode}' threw:`, err);
    allValid = false;
  }
}

// Verify bad_fix_trap caches the wrong fix (remap employee_count_old -> employees)
const trapDiag = getCachedDiagnosis("bad_fix_trap");
const trapParams = trapDiag.proposedFix.params || {};
const isWrongFix =
  trapDiag.proposedFix.type === "remap_field" &&
  (trapParams.source === "employee_count_old" || trapParams.from === "employee_count_old") &&
  (trapParams.target === "employees" || trapParams.to === "employees");

if (isWrongFix) {
  console.log("\n✓ bad_fix_trap correctly proposes the WRONG decoy field (employee_count_old -> employees) for validator rejection demo.");
} else {
  console.error("\n✗ bad_fix_trap does NOT propose the decoy field as requested!");
  allValid = false;
}

if (allValid) {
  console.log("\n=================================================");
  console.log("  ALL CACHE ENTRIES SCHEMA-VALID AND DEMO-READY  ");
  console.log("=================================================");
  process.exit(0);
} else {
  console.error("\nSome cache entries failed validation.");
  process.exit(1);
}
