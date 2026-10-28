import { NextResponse } from "next/server";
import { getRun, getStepLogs, getIncidentForRun } from "@/lib/firebase/repo";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    const run = await getRun(id);
    if (!run) {
      return NextResponse.json({ error: `Run with id '${id}' not found`, code: "RUN_NOT_FOUND" }, { status: 404 });
    }

    const steps = await getStepLogs(id);
    const incident = await getIncidentForRun(id);

    return NextResponse.json({
      run,
      steps,
      incident,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch run details";
    return NextResponse.json({ error: message, code: "RUN_FETCH_FAILED" }, { status: 500 });
  }
}
