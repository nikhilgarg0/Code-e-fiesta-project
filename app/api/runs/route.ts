import { NextResponse } from "next/server";
import { startRun } from "@/lib/engine/executor";
import { getRecentRuns } from "@/lib/firebase/repo";

const DEFAULT_SAMPLE_LEAD = {
  name: "Jane Doe",
  email: "jane@acme.com",
  company: "Acme Corp",
};

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
