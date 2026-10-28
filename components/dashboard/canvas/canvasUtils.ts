// components/dashboard/canvas/canvasUtils.ts
// Math, layout coordinates, orthogonal paths, and node state derivation

import { WorkflowRun, StepLog, Incident } from "@/lib/types";

export type CanvasNodeStatus =
  | "idle"
  | "running"
  | "success"
  | "failed"
  | "healing"
  | "healed"
  | "waiting_approval";

export interface CanvasNodeData {
  id: string;
  type: "trigger" | "step" | "healing";
  stepName?: string;
  title: string;
  subtitle: string;
  provider?: string;
  mode?: "real" | "mock";
  status: CanvasNodeStatus;
  durationMs?: number;
  badge?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rawLog?: StepLog;
  incident?: Incident | null;
  isGhost?: boolean;
}

export interface CanvasEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  path: string;
  status: "idle" | "running" | "traversed" | "failed" | "resume" | "healing";
  label?: string;
  labelX?: number;
  labelY?: number;
}

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 56;
export const HORIZONTAL_GAP = 64;
export const ROW_1_Y = 48;
export const ROW_2_Y = ROW_1_Y + NODE_HEIGHT + 72; // 176px (72px gap below main flow)

/**
 * Generate straight horizontal connector between two adjacent nodes on the same row
 */
export function createHorizontalConnector(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  if (Math.abs(y1 - y2) < 2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/**
 * Straight vertical connector from failed node to diagnose node (no diagonal)
 */
export function createStraightVerticalConnector(
  x: number,
  y1: number,
  y2: number
): string {
  return `M ${x} ${y1} L ${x} ${y2}`;
}

/**
 * Orthogonal return edge with rounded 8px corners:
 * Runs from Apply fix up into the 72px mid-gap, horizontally across to under the failed node's right port,
 * and up into the bottom of the failed node. Centered "Resume" label pill.
 */
export function createOrthogonalReturnLoop(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number
): { path: string; labelX: number; labelY: number } {
  const midY = (startY + targetY) / 2; // Dead center in the 72px gap (140px)
  const r = 8; // 8px rounded corners

  const path = `M ${startX} ${startY} L ${startX} ${midY + r} Q ${startX} ${midY} ${startX - r} ${midY} L ${targetX + r} ${midY} Q ${targetX} ${midY} ${targetX} ${midY - r} L ${targetX} ${targetY}`;

  const labelX = (startX + targetX) / 2;
  const labelY = midY;

  return { path, labelX, labelY };
}

/**
 * Derive state for standard workflow steps
 */
export function deriveStepState(
  stepName: string,
  logs: StepLog[],
  run: WorkflowRun | null,
  incident: Incident | null
): { status: CanvasNodeStatus; log?: StepLog; durationMs?: number } {
  const stepLogs = logs.filter((l) => l.stepName === stepName);
  const latestLog = stepLogs[stepLogs.length - 1];

  if (incident && incident.failedStep === stepName) {
    if (incident.outcome === "recovered" || run?.status === "healed") {
      return { status: "healed", log: latestLog, durationMs: latestLog?.durationMs };
    }
    if (incident.decision === "pending" || run?.status === "awaiting_approval") {
      return { status: "failed", log: latestLog, durationMs: latestLog?.durationMs };
    }
    if (run?.status === "healing") {
      return { status: "healing", log: latestLog, durationMs: latestLog?.durationMs };
    }
    if (latestLog?.status === "failed") {
      return { status: "failed", log: latestLog, durationMs: latestLog?.durationMs };
    }
  }

  if (!latestLog) {
    if (run?.status === "running" && run.currentStep === stepName) {
      return { status: "running" };
    }
    return { status: "idle" };
  }

  if (latestLog.status === "failed") {
    return { status: "failed", log: latestLog, durationMs: latestLog.durationMs };
  }
  if (latestLog.status === "running") {
    return { status: "running", log: latestLog };
  }
  if (latestLog.status === "success") {
    return { status: "success", log: latestLog, durationMs: latestLog.durationMs };
  }

  return { status: "idle" };
}

/**
 * Build complete layout graph of nodes and edges
 */
export function computeCanvasGraph(
  run: WorkflowRun | null,
  steps: StepLog[],
  incident: Incident | null,
  replayStepIndex: number | null = null
): { nodes: CanvasNodeData[]; edges: CanvasEdgeData[]; canvasWidth: number; canvasHeight: number; isGhostFlow: boolean } {
  const isGhostFlow = !run;

  // Filter logs if in replay mode
  const effectiveLogs = replayStepIndex !== null ? steps.slice(0, replayStepIndex + 1) : steps;

  // 1. Source Detection for Trigger node
  const payload = run?.inputPayload || {};
  let sourceLabel = "Web form";
  if (payload._source === "csv" || payload.source === "csv") {
    sourceLabel = "CSV import";
  } else if (payload._source === "webhook" || payload.source === "webhook") {
    sourceLabel = "Webhook";
  }

  // Main flow nodes definition
  const mainSteps = [
    {
      id: "node_trigger",
      type: "trigger" as const,
      title: "Lead received",
      subtitle: isGhostFlow ? "Web form / Webhook" : sourceLabel,
      provider: "Input Webhook",
      status: (isGhostFlow ? "idle" : "success") as CanvasNodeStatus,
      durationMs: 0,
    },
    {
      id: "node_validate",
      stepName: "validate_lead",
      type: "step" as const,
      title: "Validate lead",
      subtitle: "Schema check",
      provider: "Zod Engine",
    },
    {
      id: "node_enrich",
      stepName: "enrich_company",
      type: "step" as const,
      title: "Enrich company",
      subtitle: "Hunter API",
      provider: "Hunter.io",
    },
    {
      id: "node_crm",
      stepName: "save_to_crm",
      type: "step" as const,
      title: "Save to CRM",
      subtitle: "HubSpot",
      provider: "HubSpot",
    },
    {
      id: "node_email",
      stepName: "send_followup",
      type: "step" as const,
      title: "Send follow-up",
      subtitle: "Resend",
      provider: "Resend",
    },
  ];

  const nodes: CanvasNodeData[] = [];
  const edges: CanvasEdgeData[] = [];

  let currentX = 40;
  mainSteps.forEach((s) => {
    let status: CanvasNodeStatus = s.status || "idle";
    let durationMs = s.durationMs;
    let rawLog: StepLog | undefined;
    let mode: "real" | "mock" | undefined;

    if (!isGhostFlow && s.stepName) {
      const derived = deriveStepState(s.stepName, effectiveLogs, run, incident);
      status = derived.status;
      durationMs = derived.durationMs;
      rawLog = derived.log;
      if (rawLog?.request && typeof rawLog.request === "object") {
        mode = (rawLog.request as Record<string, unknown>).mode as "real" | "mock";
      }
    }

    // Build subtitle with compact duration and optional muted live/sandbox tag
    let formattedSubtitle = s.subtitle;
    if (durationMs) {
      const durSec = (durationMs / 1000).toFixed(1) + "s";
      formattedSubtitle = `${s.subtitle} · ${durSec}`;
    }

    nodes.push({
      id: s.id,
      type: s.type,
      stepName: s.stepName,
      title: s.title,
      subtitle: formattedSubtitle,
      provider: s.provider,
      mode,
      status: isGhostFlow ? "idle" : status,
      durationMs,
      x: currentX,
      y: ROW_1_Y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      rawLog,
      incident: incident?.failedStep === s.stepName ? incident : undefined,
      isGhost: isGhostFlow,
    });

    currentX += NODE_WIDTH + HORIZONTAL_GAP;
  });

  // Main flow horizontal edges: 0 -> 1 -> 2 -> 3 -> 4
  for (let i = 0; i < 4; i++) {
    const srcNode = nodes[i];
    const tgtNode = nodes[i + 1];

    let edgeStatus: CanvasEdgeData["status"] = "idle";
    if (!isGhostFlow) {
      if (srcNode.status === "failed") {
        edgeStatus = "failed";
      } else if (tgtNode.status === "running") {
        edgeStatus = "running";
      } else if (srcNode.status === "success" || srcNode.status === "healed") {
        edgeStatus = tgtNode.status !== "idle" ? "traversed" : "idle";
      }
    }

    const startX = srcNode.x + srcNode.width;
    const startY = srcNode.y + srcNode.height / 2;
    const endX = tgtNode.x;
    const endY = tgtNode.y + tgtNode.height / 2;

    edges.push({
      id: `edge_${srcNode.id}_${tgtNode.id}`,
      sourceId: srcNode.id,
      targetId: tgtNode.id,
      path: createHorizontalConnector(startX, startY, endX, endY),
      status: edgeStatus,
    });
  }

  // 2. Healing Branch (Revealed when an incident occurs)
  const hasIncident = Boolean(incident || effectiveLogs.some((l) => l.stepName.startsWith("autobot:")));

  if (!isGhostFlow && hasIncident && incident && run) {
    const failedNode = nodes.find((n) => n.stepName === incident.failedStep) || nodes[2];
    const anchorX = failedNode.x; // Strict vertical alignment directly beneath failed node

    const diagLog = effectiveLogs.find((l) => l.stepName === "autobot:diagnosed");
    const valLog = effectiveLogs.find((l) => l.stepName === "autobot:validated");
    const decLog = effectiveLogs.find((l) => l.stepName === "autobot:decided");
    const appLog = effectiveLogs.find((l) => l.stepName === "autobot:applied");

    // H1: Diagnose
    let h1Status: CanvasNodeStatus = "idle";
    if (diagLog || incident.diagnosis) {
      h1Status = "success";
    } else if (run.status === "healing") {
      h1Status = "healing";
    }

    // H2: Verify fix
    let h2Status: CanvasNodeStatus = "idle";
    if (valLog || incident.validationResult) {
      const valid = incident.validationResult ? incident.validationResult.valid : valLog?.status === "success";
      h2Status = valid ? "success" : "failed";
    } else if (h1Status === "success") {
      h2Status = "healing";
    }

    // H3: Decide
    let h3Status: CanvasNodeStatus = "idle";
    let decideBadge: string | undefined;
    if (incident.decision === "pending") {
      h3Status = "waiting_approval";
      decideBadge = "Needs your approval";
    } else if (incident.decision === "rejected_by_validator") {
      h3Status = "failed";
      decideBadge = "Escalated to human";
    } else if (incident.decision === "approved" || incident.decision === "auto_applied") {
      h3Status = "success";
      decideBadge = incident.decision === "auto_applied" ? "Auto-applied" : "Approved";
    } else if (incident.decision === "rejected") {
      h3Status = "failed";
      decideBadge = "Rejected";
    } else if (h2Status === "success") {
      h3Status = "healing";
    }

    // H4: Apply fix
    let h4Status: CanvasNodeStatus = "idle";
    if (appLog || run.status === "healed") {
      h4Status = "success";
    } else if (h3Status === "success" && (incident.decision === "auto_applied" || incident.decision === "approved")) {
      h4Status = "healing";
    }

    const confScore = incident.diagnosis?.confidence ? `${Math.round(incident.diagnosis.confidence * 100)}%` : "High";
    const passedChecks = incident.validationResult?.checks ? incident.validationResult.checks.filter((c) => c.passed).length : 5;
    const totalChecks = incident.validationResult?.checks?.length || 5;

    const healingNodesData: CanvasNodeData[] = [
      {
        id: "node_h_diagnose",
        type: "healing",
        stepName: "autobot:diagnosed",
        title: "Diagnose",
        subtitle: `Gemini 2.5 Flash · ${confScore}`,
        provider: "Google Gemini",
        status: h1Status,
        x: anchorX,
        y: ROW_2_Y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        rawLog: diagLog,
        incident,
      },
      {
        id: "node_h_verify",
        type: "healing",
        stepName: "autobot:validated",
        title: "Verify fix",
        subtitle: `${passedChecks}/${totalChecks} checks pass`,
        provider: "AutoMedic Validator",
        status: h2Status,
        x: anchorX + NODE_WIDTH + HORIZONTAL_GAP,
        y: ROW_2_Y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        rawLog: valLog,
        incident,
      },
      {
        id: "node_h_decide",
        type: "healing",
        stepName: "autobot:decided",
        title: "Decide",
        subtitle: decideBadge || "Policy check",
        provider: "Policy Engine",
        status: h3Status,
        badge: decideBadge,
        x: anchorX + (NODE_WIDTH + HORIZONTAL_GAP) * 2,
        y: ROW_2_Y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        rawLog: decLog,
        incident,
      },
      {
        id: "node_h_apply",
        type: "healing",
        stepName: "autobot:applied",
        title: "Apply fix",
        subtitle: incident.proposedFix?.type === "remap_field" ? "Remap fields & schema" : "Apply patch",
        provider: "Runtime Engine",
        status: h4Status,
        x: anchorX + (NODE_WIDTH + HORIZONTAL_GAP) * 3,
        y: ROW_2_Y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        rawLog: appLog,
        incident,
      },
    ];

    nodes.push(...healingNodesData);

    // Connector 1: Straight vertical line directly from failed node bottom to Diagnose top
    const verticalX = failedNode.x + NODE_WIDTH / 2;
    edges.push({
      id: `edge_down_${failedNode.id}`,
      sourceId: failedNode.id,
      targetId: healingNodesData[0].id,
      path: createStraightVerticalConnector(verticalX, failedNode.y + failedNode.height, ROW_2_Y),
      status: "failed",
    });

    // Connectors between healing nodes: H1 -> H2 -> H3 -> H4
    for (let j = 0; j < 3; j++) {
      const hSrc = healingNodesData[j];
      const hTgt = healingNodesData[j + 1];

      let hEdgeStatus: CanvasEdgeData["status"] = "idle";
      if (hSrc.status === "failed") {
        hEdgeStatus = "failed";
      } else if (hTgt.status === "healing" || hTgt.status === "running") {
        hEdgeStatus = "running";
      } else if (hSrc.status === "success") {
        hEdgeStatus = "traversed";
      }

      edges.push({
        id: `edge_h_${hSrc.id}_${hTgt.id}`,
        sourceId: hSrc.id,
        targetId: hTgt.id,
        path: createHorizontalConnector(
          hSrc.x + hSrc.width,
          hSrc.y + hSrc.height / 2,
          hTgt.x,
          hTgt.y + hTgt.height / 2
        ),
        status: hEdgeStatus,
      });
    }

    // Connector: Orthogonal return edge with rounded 8px corners from Apply fix to bottom of failed node
    // Starts at top of Apply fix (x + NODE_WIDTH / 2), travels to mid-gap (140px), across to failed node right port
    const returnLoop = createOrthogonalReturnLoop(
      healingNodesData[3].x + healingNodesData[3].width / 2,
      healingNodesData[3].y,
      failedNode.x + NODE_WIDTH - 24,
      failedNode.y + failedNode.height
    );

    edges.push({
      id: `edge_return_${failedNode.id}`,
      sourceId: healingNodesData[3].id,
      targetId: failedNode.id,
      path: returnLoop.path,
      status: h4Status === "success" || run.status === "healed" ? "resume" : "idle",
      label: "Resume",
      labelX: returnLoop.labelX,
      labelY: returnLoop.labelY,
    });
  }

  // Compute total canvas bounding box from node layout coordinates
  const maxX = Math.max(...nodes.map((n) => n.x + n.width), 1360) + 40;
  const maxY = Math.max(...nodes.map((n) => n.y + n.height), 260) + 40;

  return { nodes, edges, canvasWidth: maxX, canvasHeight: maxY, isGhostFlow };
}
