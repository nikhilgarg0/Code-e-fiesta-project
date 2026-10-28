import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { addStepLog } from "@/lib/firebase/repo";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const incidentRef = adminDb.collection("incidents").doc(id);

    let runId = "";
    const now = new Date().toISOString();

    await adminDb.runTransaction(async (t) => {
      const doc = await t.get(incidentRef);
      if (!doc.exists) {
        throw new Error("INCIDENT_NOT_FOUND");
      }

      const data = doc.data();
      const decision = data?.decision;

      // Can reject if pending or rejected_by_validator
      if (decision !== "pending" && decision !== "rejected_by_validator") {
        throw new Error("NOT_AWAITING_DECISION");
      }

      runId = data?.runId;
      const runRef = adminDb.collection("runs").doc(runId);

      t.update(incidentRef, {
        decision: "rejected",
        outcome: "failed",
        resolvedAt: now,
        resolvedBy: "human",
      });

      t.update(runRef, {
        status: "failed",
        finishedAt: now,
      });
    });

    // Record human rejection step log on the run timeline
    await addStepLog(runId, {
      stepName: "autobot:rejected",
      status: "failed",
      request: { incidentId: id, rejectedBy: "human" },
      response: { decision: "rejected", outcome: "failed" },
      errorMessage: "Human operator rejected proposed fix. Run terminated permanently.",
      errorCode: "HUMAN_REJECTED",
      durationMs: 0,
      timestamp: now,
    });

    return NextResponse.json({
      message: "Incident rejected. Run marked as permanently failed.",
      decision: "rejected",
      outcome: "failed",
      runId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Rejection failed";

    if (message === "NOT_AWAITING_DECISION") {
      return NextResponse.json(
        { error: "Incident is not awaiting a decision (already decided or resolved).", code: "NOT_AWAITING_DECISION" },
        { status: 409 }
      );
    }
    if (message === "INCIDENT_NOT_FOUND") {
      return NextResponse.json({ error: "Incident not found.", code: "INCIDENT_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ error: message, code: "REJECTION_FAILED" }, { status: 500 });
  }
}
