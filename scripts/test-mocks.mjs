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

async function callEndpoint(path, payload) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const headers = Object.fromEntries(res.headers.entries());
  let body;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  return { status: res.status, headers, body };
}

function logTestHeader(mode, desc) {
  console.log(`\n======================================================`);
  console.log(`🧪 TESTING CHAOS MODE: [${mode.toUpperCase()}]`);
  console.log(`ℹ️  ${desc}`);
  console.log(`======================================================`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function run() {
  console.log(`🚀 Starting Mock & Chaos Deterministic Test Suite against ${BASE_URL}...`);

  // -------------------------------------------------------------------
  // 1. MODE: none
  // -------------------------------------------------------------------
  logTestHeader("none", "All mock endpoints return standard 200 responses.");
  await setChaosMode("none");

  const enrichNormal = await callEndpoint("/api/mock/enrichment", { company: "Acme Corp" });
  console.log(`  POST /api/mock/enrichment -> Status: ${enrichNormal.status}`, enrichNormal.body);
  assert(enrichNormal.status === 200, "Enrichment returns 200");
  assert(enrichNormal.body.employees === 85, "Enrichment returns employees: 85 (number)");

  const crmNormal = await callEndpoint("/api/mock/crm", {
    full_name: "Jane Doe",
    email: "jane@acme.com",
    company: "Acme Corp",
    employees: 85,
  });
  console.log(`  POST /api/mock/crm -> Status: ${crmNormal.status}`, crmNormal.body);
  assert(crmNormal.status === 200, "CRM returns 200");
  assert(crmNormal.body.status === "created", "CRM lead created");

  const emailNormal = await callEndpoint("/api/mock/email", {
    to: "jane@acme.com",
    subject: "Welcome to AutoMedic",
    body: "Lead ingested successfully.",
  });
  console.log(`  POST /api/mock/email -> Status: ${emailNormal.status}`, emailNormal.body);
  assert(emailNormal.status === 200, "Email returns 200");

  // -------------------------------------------------------------------
  // 2. MODE: schema_drift
  // -------------------------------------------------------------------
  logTestHeader("schema_drift", "Enrichment returns 'staff_count' instead of 'employees'.");
  await setChaosMode("schema_drift");

  const enrichDrift = await callEndpoint("/api/mock/enrichment", { company: "Stark Tech" });
  console.log(`  POST /api/mock/enrichment -> Status: ${enrichDrift.status}`, enrichDrift.body);
  assert(enrichDrift.status === 200, "Returns 200 status code");
  assert(enrichDrift.body.staff_count === 85, "Has 'staff_count: 85'");
  assert(enrichDrift.body.employees === undefined, "Does NOT have 'employees' field");

  // -------------------------------------------------------------------
  // 3. MODE: transient_500
  // -------------------------------------------------------------------
  logTestHeader("transient_500", "Enrichment fails with 500 on calls 1 & 2, then succeeds on call 3.");
  await setChaosMode("transient_500");

  const t1 = await callEndpoint("/api/mock/enrichment", { company: "Wayne Ent" });
  console.log(`  Call 1 -> Status: ${t1.status}`, t1.body);
  assert(t1.status === 500, "Call 1 returns HTTP 500");
  assert(t1.body.attempt === 1, "Attempt counter is 1");

  const t2 = await callEndpoint("/api/mock/enrichment", { company: "Wayne Ent" });
  console.log(`  Call 2 -> Status: ${t2.status}`, t2.body);
  assert(t2.status === 500, "Call 2 returns HTTP 500");
  assert(t2.body.attempt === 2, "Attempt counter is 2");

  const t3 = await callEndpoint("/api/mock/enrichment", { company: "Wayne Ent" });
  console.log(`  Call 3 -> Status: ${t3.status}`, t3.body);
  assert(t3.status === 200, "Call 3 returns HTTP 200 (recovered)");
  assert(t3.body.employees === 85, "Call 3 returns valid employees number");

  // -------------------------------------------------------------------
  // 4. MODE: rate_limit
  // -------------------------------------------------------------------
  logTestHeader("rate_limit", "CRM returns 429 with Retry-After on calls 1 & 2, then succeeds on call 3.");
  await setChaosMode("rate_limit");

  const r1 = await callEndpoint("/api/mock/crm", {
    full_name: "Bruce Wayne",
    email: "bruce@wayne.com",
    company: "Wayne Ent",
    employees: 1000,
  });
  console.log(`  Call 1 -> Status: ${r1.status}, Retry-After: ${r1.headers["retry-after"]}`, r1.body);
  assert(r1.status === 429, "Call 1 returns HTTP 429");
  assert(r1.headers["retry-after"] === "1", "Call 1 provides Retry-After header");

  const r2 = await callEndpoint("/api/mock/crm", {
    full_name: "Bruce Wayne",
    email: "bruce@wayne.com",
    company: "Wayne Ent",
    employees: 1000,
  });
  console.log(`  Call 2 -> Status: ${r2.status}`, r2.body);
  assert(r2.status === 429, "Call 2 returns HTTP 429");

  const r3 = await callEndpoint("/api/mock/crm", {
    full_name: "Bruce Wayne",
    email: "bruce@wayne.com",
    company: "Wayne Ent",
    employees: 1000,
  });
  console.log(`  Call 3 -> Status: ${r3.status}`, r3.body);
  assert(r3.status === 200, "Call 3 succeeds with HTTP 200");
  assert(r3.body.status === "created", "Call 3 creates CRM lead");

  // -------------------------------------------------------------------
  // 5. MODE: bad_type
  // -------------------------------------------------------------------
  logTestHeader("bad_type", "Enrichment returns employees as string 'approx 50'.");
  await setChaosMode("bad_type");

  const enrichBadType = await callEndpoint("/api/mock/enrichment", { company: "Cyberdyne" });
  console.log(`  POST /api/mock/enrichment -> Status: ${enrichBadType.status}`, enrichBadType.body);
  assert(enrichBadType.status === 200, "Returns 200 status code");
  assert(enrichBadType.body.employees === "approx 50", "Returns employees as string 'approx 50'");
  assert(typeof enrichBadType.body.employees === "string", "Type is string instead of number");

  // -------------------------------------------------------------------
  // 6. MODE: primary_down
  // -------------------------------------------------------------------
  logTestHeader("primary_down", "Primary enrichment returns 503; fallback v2 returns 200 healthy.");
  await setChaosMode("primary_down");

  const enrichPrimary = await callEndpoint("/api/mock/enrichment", { company: "Umbrella Corp" });
  console.log(`  POST /api/mock/enrichment (primary) -> Status: ${enrichPrimary.status}`, enrichPrimary.body);
  assert(enrichPrimary.status === 503, "Primary returns HTTP 503 Service Unavailable");
  assert(enrichPrimary.body.fallbackEndpoint === "/api/mock/enrichment-v2", "Primary recommends fallback v2");

  const enrichV2 = await callEndpoint("/api/mock/enrichment-v2", { company: "Umbrella Corp" });
  console.log(`  POST /api/mock/enrichment-v2 (fallback) -> Status: ${enrichV2.status}`, enrichV2.body);
  assert(enrichV2.status === 200, "Fallback v2 returns HTTP 200");
  assert(enrichV2.body.employees === 85, "Fallback v2 returns valid employees schema");

  // -------------------------------------------------------------------
  // 7. MODE: bad_fix_trap
  // -------------------------------------------------------------------
  logTestHeader("bad_fix_trap", "Enrichment returns staff_count (85) AND decoy employee_count_old (5).");
  await setChaosMode("bad_fix_trap");

  const enrichTrap = await callEndpoint("/api/mock/enrichment", { company: "Initech" });
  console.log(`  POST /api/mock/enrichment -> Status: ${enrichTrap.status}`, enrichTrap.body);
  assert(enrichTrap.status === 200, "Returns 200 status code");
  assert(enrichTrap.body.staff_count === 85, "Contains correct staff_count: 85");
  assert(enrichTrap.body.employee_count_old === 5, "Contains decoy employee_count_old: 5");

  // -------------------------------------------------------------------
  // Clean up: Reset back to 'none'
  // -------------------------------------------------------------------
  console.log(`\n======================================================`);
  console.log(`🧹 RESETTING CHAOS MODE TO 'none'`);
  await setChaosMode("none");
  console.log(`  ✓ Chaos mode restored to 'none' and counters cleared.`);
  console.log(`======================================================`);
  console.log(`\n🎉 ALL 7 CHAOS MODES AND MOCK ENDPOINTS TESTED SUCCESSFULLY!`);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
