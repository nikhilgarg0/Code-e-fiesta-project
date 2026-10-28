import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { addStepLog } from "@/lib/firebase/repo";
import { buildConfigPatch } from "@/lib/engine/heal";
import { resumeRun } from "@/lib/engine/executor";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const incidentRef = adminDb.collection("incidents").doc(id);

    let runId = "";
    let failedStep = "";
    let proposedFix: Record<string, unknown> | null = null;

    // Run within a transaction to ensure idempotency and prevent double-clicks
    await adminDb.runTransaction(async (t) => {
      const doc = await t.get(incidentRef);
      if (!doc.exists) {
        throw new Error("INCIDENT_NOT_FOUND");
      }

      const data = doc.data();
      const decision = data?.decision;

      if (decision === "rejected_by_validator") {
        throw new Error("CANNOT_APPROVE_INVALID_FIX");
      }

      if (decision !== "pending") {
        throw new Error("NOT_AWAITING_DECISION");
      }

      runId = data?.runId;
      failedStep = data?.failedStep;
      proposedFix = data?.proposedFix || data?.diagnosis?.proposedFix || null;

      t.update(incidentRef, {
        decision: "approved",
        resolvedBy: "human",
        updatedAt: new Date().toISOString(),
      });
    });

    if (!proposedFix) {
      return NextResponse.json({ error: "No proposed fix found to apply" }, { status: 400 });
    }

    const patch = buildConfigPatch(proposedFix as { type: string; params?: Record<string, unknown> });

    // Record human approval timeline steps
    await addStepLog(runId, {
      stepName: "autobot:applied",
      status: "success",
      request: { patch, targetStep: failedStep, approvedBy: "human" },
      response: { action: "human_approved", appliedAt: new Date().toISOString() },
      errorMessage: null,
      errorCode: null,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    });

    await addStepLog(runId, {
      stepName: "autobot:resumed",
      status: "running",
      request: { fromStep: failedStep, triggeredBy: "human" },
      response: { resuming: true },
      errorMessage: null,
      errorCode: null,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    });

    // Resume execution with human attribution
    await resumeRun(runId, failedStep, patch, "human");

    return NextResponse.json({
      message: "Incident successfully approved and workflow execution resumed.",
      decision: "approved",
      runId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Approval failed";

    if (message === "CANNOT_APPROVE_INVALID_FIX") {
      return NextResponse.json(
        { error: "A human cannot approve a fix that failed validation checks.", code: "CANNOT_APPROVE_INVALID_FIX" },
        { status: 409 }
      );
    }
    if (message === "NOT_AWAITING_DECISION") {
      return NextResponse.json(
        { error: "Incident is not awaiting approval (already decided or resolved).", code: "NOT_AWAITING_DECISION" },
        { status: 409 }
      );
    }
    if (message === "INCIDENT_NOT_FOUND") {
      return NextResponse.json({ error: "Incident not found.", code: "INCIDENT_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ error: message, code: "APPROVAL_FAILED" }, { status: 500 });
  }
}
