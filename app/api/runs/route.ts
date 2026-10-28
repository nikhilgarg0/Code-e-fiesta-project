import { NextResponse } from "next/server";
import { startRun } from "@/lib/engine/executor";
import { getRecentRuns, resetChaosCounters } from "@/lib/firebase/repo";

const DEFAULT_SAMPLE_LEAD = {
  name: "Jane Doe",
  email: "jane@acme.com",
  company: "Acme Corp",
};

const RANDOM_FAULT_SCENARIOS = [
  "schema_drift",
  "transient_500",
  "rate_limit",
  "bad_type",
  "primary_down",
  "bad_fix_trap",
] as const;

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const workflowName = (body.workflowName as string) || "lead_to_crm";
    const lead = (body.lead as Record<string, unknown>) || DEFAULT_SAMPLE_LEAD;

    // Use random error/problem each time a new lead comes in (or use explicit mode if test suite passes it)
    if (body.mode) {
      await resetChaosCounters(String(body.mode));
    } else {
      const randomIndex = Math.floor(Math.random() * RANDOM_FAULT_SCENARIOS.length);
      const randomFault = RANDOM_FAULT_SCENARIOS[randomIndex];
      await resetChaosCounters(randomFault);
    }

    const runId = await startRun(workflowName, lead);
    return NextResponse.json({ runId }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initiate workflow run";
    return NextResponse.json({ error: message, code: "RUN_START_FAILED" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get("limit") || "20", 10);

  try {
    const runs = await getRecentRuns(limit);
    return NextResponse.json(runs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch runs";
    return NextResponse.json({ error: message, code: "RUNS_FETCH_FAILED" }, { status: 500 });
  }
}
