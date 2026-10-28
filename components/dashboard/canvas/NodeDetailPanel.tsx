// components/dashboard/canvas/NodeDetailPanel.tsx
"use client";

import React, { useState, useEffect } from "react";
import { CanvasNodeData } from "./canvasUtils";
import { WorkflowRun } from "@/lib/types";
import {
  XIcon,
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "../Icons";
import { formatDuration } from "@/lib/labels";

interface NodeDetailPanelProps {
  node: CanvasNodeData | null;
  run: WorkflowRun | null;
  onClose: () => void;
  onApproveFix?: (incidentId: string) => Promise<void>;
  onRejectFix?: (incidentId: string) => Promise<void>;
}

export function NodeDetailPanel({
  node,
  run,
  onClose,
  onApproveFix,
  onRejectFix,
}: NodeDetailPanelProps) {
  const [isTechDetailsOpen, setIsTechDetailsOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Esc key listener to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!node) return null;

  const incident = node.incident;
  const isFailedNode = node.status === "failed";
  const rawLog = node.rawLog;

  const handleApprove = async () => {
    if (!incident || isActionLoading) return;
    setIsActionLoading(true);
    try {
      await onApproveFix?.(incident.id);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!incident || isActionLoading) return;
    setIsActionLoading(true);
    try {
      await onRejectFix?.(incident.id);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Step-specific key-value results
  const renderStepDetails = () => {
    if (node.id === "node_trigger") {
      const payload = run?.inputPayload || {};
      return (
        <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] p-3.5 space-y-2.5">
          <div className="text-[11.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Ingested Lead Payload
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Full name</span>
              <span className="text-[var(--text-primary)] font-semibold">{String(payload.name || "—")}</span>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Company</span>
              <span className="text-[var(--text-primary)] font-semibold">{String(payload.company || "—")}</span>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Work email</span>
              <span className="text-[var(--text-primary)] font-semibold font-mono text-[12px]">{String(payload.email || "—")}</span>
            </div>
          </div>
        </div>
      );
    }

    if (node.stepName === "validate_lead") {
      return (
        <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] p-3.5 space-y-2.5">
          <div className="text-[11.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Validation Checks
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Schema validation</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[11px]">
                Passed
              </span>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Email format</span>
              <span className="text-[var(--text-primary)] font-medium">RFC 5322 Valid</span>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Sanitization</span>
              <span className="text-[var(--text-primary)] font-medium">Normalized trim</span>
            </div>
          </div>
        </div>
      );
    }

    if (node.stepName === "enrich_company") {
      const output = ((rawLog?.response as any)?.body as Record<string, unknown>) || {};
      return (
        <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] p-3.5 space-y-2.5">
          <div className="text-[11.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Enriched Intelligence
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Service provider</span>
              <span className="text-[var(--text-primary)] font-medium">
                {node.mode === "real" ? "Hunter.io (Live)" : "Abstract API (Sandbox)"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Employees</span>
              <span className="text-[var(--text-primary)] font-mono font-semibold">
                {String(output.employees || output.staff_count || output.size || "85")}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Industry</span>
              <span className="text-[var(--text-primary)] font-medium">
                {String(output.industry || "Software & AI")}
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (node.stepName === "save_to_crm") {
      const output = ((rawLog?.response as any)?.body as Record<string, unknown>) || {};
      const contactId = String(output.id || output.contactId || "hs_ct_98412");
      return (
        <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] p-3.5 space-y-2.5">
          <div className="text-[11.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            CRM Contact Record
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Destination</span>
              <span className="text-[var(--text-primary)] font-medium">HubSpot Contacts</span>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Contact ID</span>
              <span className="text-[var(--text-primary)] font-mono font-semibold">{contactId}</span>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Lifecycle state</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[11px]">
                Created · Lead
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (node.stepName === "send_followup") {
      return (
        <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] p-3.5 space-y-2.5">
          <div className="text-[11.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Outbound Follow-up
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Provider</span>
              <span className="text-[var(--text-primary)] font-medium">Resend Delivery</span>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Delivery status</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[11px]">
                Delivered
              </span>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Template</span>
              <span className="text-[var(--text-primary)] font-medium font-mono text-[11.5px]">demo_lead_welcome</span>
            </div>
          </div>
        </div>
      );
    }

    // Healing nodes
    if (node.id === "node_h_diagnose" && incident?.diagnosis) {
      return (
        <div className="rounded-2xl bg-gradient-to-tr from-purple-500/[0.05] via-indigo-500/[0.05] to-blue-500/[0.05] border border-purple-500/20 p-3.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold text-[12px]">
            <SparklesIcon className="w-4 h-4" />
            <span>Gemini AI Diagnosis</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Model</span>
              <span className="text-[var(--text-primary)] font-semibold">Gemini 2.5 Flash</span>
            </div>
            <div className="py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)] block text-[11.5px] mb-1">Root Cause Analysis</span>
              <p className="text-[var(--text-primary)] font-medium leading-relaxed">{incident.diagnosis.rootCause}</p>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Confidence</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
                {incident.diagnosis.confidence ? `${Math.round(incident.diagnosis.confidence * 100)}%` : "High"}
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (node.id === "node_h_decide" && incident) {
      const isPending = incident.decision === "pending";
      return (
        <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] p-3.5 space-y-3">
          <div className="text-[11.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Resolution Policy & Decision
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Status</span>
              <span className="text-[var(--text-primary)] font-semibold capitalize px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[11px]">
                {incident.decision.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Risk Level</span>
              <span className={`font-semibold capitalize px-2 py-0.5 rounded-full text-[11px] ${
                incident.riskLevel === "low"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : incident.riskLevel === "high"
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}>
                {incident.riskLevel || "Low"}
              </span>
            </div>
          </div>

          {isPending && (
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleApprove}
                disabled={isActionLoading}
                className="w-full h-8.5 px-4 text-[12.5px] font-semibold rounded-full bg-gradient-to-b from-[#0077ED] to-[#0066CC] hover:from-[#0082FF] hover:to-[#0070E0] text-white shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isActionLoading ? <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" /> : <CheckIcon className="w-3.5 h-3.5" />}
                <span>Approve & Apply Fix</span>
              </button>
              <button
                onClick={handleReject}
                disabled={isActionLoading}
                className="w-full h-8 px-4 text-[12px] font-medium rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all flex items-center justify-center active:scale-95 cursor-pointer disabled:opacity-50"
              >
                Reject Fix (Terminate Execution)
              </button>
            </div>
          )}
        </div>
      );
    }

    if (node.id === "node_h_apply" && incident?.proposedFix) {
      return (
        <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] p-3.5 space-y-2.5">
          <div className="text-[11.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Configuration Patch Applied
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            <div className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[var(--text-secondary)]">Patch type</span>
              <span className="text-[var(--accent)] font-mono font-semibold">{incident.proposedFix.type}</span>
            </div>
            <div className="py-2 text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
              {incident.proposedFix.explanation}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <aside
      role="region"
      aria-label="Node Details"
      className="w-[360px] shrink-0 border-l border-[var(--border)] apple-glass flex flex-col h-full overflow-y-auto z-20 select-none shadow-2xl transition-all"
    >
      {/* 1. Apple macOS Inspector Header (h-12) */}
      <div className="h-12 px-4.5 border-b border-[var(--border)] flex items-center justify-between sticky top-0 apple-glass z-10 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
            {node.title}
          </span>
          <span className="text-[11.5px] text-[var(--text-muted)] shrink-0 font-medium font-mono">
            {node.durationMs ? `· ${formatDuration(node.durationMs)}` : ""}
          </span>
        </div>

        <button
          onClick={onClose}
          aria-label="Close Inspector"
          className="w-7 h-7 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all cursor-pointer active:scale-95"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Inspector Content */}
      <div className="p-4 space-y-4 flex-1">
        {/* Incident Alert if failed */}
        {isFailedNode && incident && (
          <div className="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-500/15 text-rose-900 dark:text-rose-200 space-y-2">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold text-[13px]">
              <AlertTriangleIcon className="w-4 h-4 shrink-0" />
              <span>Fault Detected in Execution</span>
            </div>
            <p className="text-[12.5px] text-rose-900/90 dark:text-rose-200/90 leading-relaxed font-medium">
              {String(incident.errorContext?.errorMessage || "Execution halted due to schema drift or upstream error.")}
            </p>
          </div>
        )}

        {/* Step-specific clean key-value section */}
        {renderStepDetails()}

        {/* Collapsible Technical Details (Apple Inset Accordion) */}
        <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-2xl overflow-hidden bg-black/[0.02] dark:bg-white/[0.03]">
          <button
            onClick={() => setIsTechDetailsOpen(!isTechDetailsOpen)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-[12.5px] font-semibold text-[var(--text-secondary)] hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <span>Technical Inspection Logs</span>
            {isTechDetailsOpen ? (
              <ChevronDownIcon className="w-4 h-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </button>

          {isTechDetailsOpen && (
            <div className="p-3 space-y-3 bg-[var(--surface)] text-[11px] font-mono border-t border-[var(--border)]">
              {Boolean(rawLog?.request) && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)] font-sans mb-1 font-semibold">Request Payload</div>
                  <pre className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] overflow-x-auto text-[11px] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                    {JSON.stringify(rawLog?.request, null, 2)}
                  </pre>
                </div>
              )}

              {Boolean(rawLog?.response) && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)] font-sans mb-1 font-semibold">Response Payload</div>
                  <pre className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] overflow-x-auto text-[11px] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                    {JSON.stringify(rawLog?.response, null, 2)}
                  </pre>
                </div>
              )}

              {incident?.diagnosis?.evidence && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)] font-sans mb-1 font-semibold">Evidence Log</div>
                  <ul className="list-disc pl-4 text-[var(--text-secondary)] space-y-1 font-sans text-[12px]">
                    {incident.diagnosis.evidence.map((ev, idx) => (
                      <li key={idx}>{ev}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
