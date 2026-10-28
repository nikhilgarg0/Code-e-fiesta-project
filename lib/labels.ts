// lib/labels.ts
// Plain-English microcopy and label mappings for AutoMedic

import { WorkflowRun, Incident, WorkflowRunStatus, ChaosMode } from "./types";

export function getStepDisplayName(stepName: string): string {
  switch (stepName) {
    case "validate_lead":
      return "Validate lead";
    case "enrich_company":
      return "Look up company";
    case "save_to_crm":
      return "Save to CRM";
    case "send_followup":
      return "Send follow-up email";
    case "autobot:diagnosed":
      return "Diagnosed by AI";
    case "autobot:validated":
      return "Checked the fix";
    case "autobot:decided":
      return "Decided by policy";
    case "autobot:applied":
      return "Applied the fix";
    case "autobot:resumed":
      return "Resumed from failed step";
    default:
      if (stepName.startsWith("autobot:")) {
        return stepName.replace("autobot:", "Self-healing: ");
      }
      return stepName.replace(/_/g, " ");
  }
}

export function getRunStatusInfo(status: WorkflowRunStatus): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (status) {
    case "success":
      return {
        label: "Completed",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
        dotClass: "bg-emerald-500",
      };
    case "healed":
      return {
        label: "Healed automatically",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
        dotClass: "bg-emerald-500",
      };
    case "awaiting_approval":
      return {
        label: "Needs approval",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
        dotClass: "bg-amber-500",
      };
    case "healing":
      return {
        label: "Healing in progress",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800",
        dotClass: "bg-indigo-500",
      };
    case "running":
      return {
        label: "Running",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800",
        dotClass: "bg-indigo-500",
      };
    case "failed":
      return {
        label: "Failed",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
        dotClass: "bg-rose-500",
      };
    default:
      return {
        label: status,
        badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
        dotClass: "bg-zinc-400",
      };
  }
}

export function getRunStory(run: WorkflowRun, incident?: Incident | null): string {
  if (run.status === "awaiting_approval") {
    if (incident?.diagnosis?.failureCategory === "bad_data") {
      return "Unexpected data format → Needs your review";
    }
    if (incident?.decision === "rejected_by_validator") {
      return "Safety check caught unsafe fix → Needs your decision";
    }
    return "Needs your review to continue";
  }

  if (run.status === "healed") {
    if (incident?.resolvedBy === "human") {
      return "Approved by you → Resumed and completed";
    }
    const fixType = incident?.proposedFix?.type;
    if (fixType === "remap_field") {
      const src = incident?.proposedFix?.params?.sourceField || incident?.proposedFix?.params?.source || "fields";
      return `API format changed (${src}) → Fixed automatically`;
    }
    if (fixType === "retry_with_backoff") {
      return "Temporary server error → Auto-recovered with backoff";
    }
    if (fixType === "switch_to_fallback_endpoint") {
      return "Primary service down → Switched to backup endpoint";
    }
    return "Issue detected → Fixed automatically";
  }

  if (run.status === "healing") {
    return "Investigating issue and testing fixes...";
  }

  if (run.status === "running") {
    return "Processing lead intake...";
  }

  if (run.status === "failed") {
    return "Stopped after unrecoverable error";
  }

  return "Completed without issues";
}

export function getChaosModeInfo(mode: ChaosMode): {
  name: string;
  description: string;
} {
  switch (mode) {
    case "none":
      return {
        name: "Normal operation",
        description: "All services respond normally with standard schemas",
      };
    case "schema_drift":
      return {
        name: "API response format changed",
        description: "Upstream renamed 'employees' to 'staff_count'",
      };
    case "transient_500":
      return {
        name: "Temporary server error (500)",
        description: "Simulates 2 transient 500 errors before recovering",
      };
    case "bad_type":
      return {
        name: "Unexpected data type",
        description: "API returns text 'approx 50' instead of a number",
      };
    case "primary_down":
      return {
        name: "Primary service down (503)",
        description: "Service unavailable; fails over to backup endpoint",
      };
    case "bad_fix_trap":
      return {
        name: "Unsafe fix trap",
        description: "Sends deprecated field; guardrail prevents unsafe fix",
      };
    case "rate_limit":
      return {
        name: "Rate limit reached (429)",
        description: "Limits requests and provides Retry-After header",
      };
  }
}

export function getConfidenceBadge(confidence?: number): {
  label: "High" | "Medium" | "Low";
  badgeClass: string;
} {
  if (confidence === undefined || confidence === null) {
    return { label: "Medium", badgeClass: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" };
  }
  if (confidence >= 0.85) {
    return { label: "High", badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" };
  }
  if (confidence >= 0.65) {
    return { label: "Medium", badgeClass: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800" };
  }
  return { label: "Low", badgeClass: "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" };
}

export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diffSec < 10) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return "";
  }
}

export function formatDuration(durationMs?: number): string {
  if (durationMs === undefined || durationMs === null) return "-";
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}
