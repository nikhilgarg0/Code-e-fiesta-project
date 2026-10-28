"use client";

import React, { useState } from "react";
import { Incident, RiskLevel, IncidentDecision } from "@/lib/types";
import {
  ShieldCheckIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  WrenchIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BotIcon,
  SparklesIcon,
} from "./Icons";

interface IncidentPanelProps {
  incidents: Incident[];
  onActionComplete?: (message: string) => void;
  onErrorToast?: (error: string) => void;
  onRunTriggered?: (runId: string) => void;
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  switch (risk) {
    case "low":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
          Low Risk
        </span>
      );
    case "medium":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-amber-500/15 text-amber-300 border border-amber-500/40">
          Medium Risk
        </span>
      );
    case "high":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-rose-500/15 text-rose-300 border border-rose-500/40">
          High Risk
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 text-zinc-400">
          {risk}
        </span>
      );
  }
}

function DecisionBanner({ decision }: { decision: IncidentDecision }) {
  switch (decision) {
    case "auto_applied":
      return (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs font-mono flex items-center gap-2.5 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
          <BotIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="font-bold text-emerald-300">Decision: Auto-Applied</div>
            <div className="text-[11px] text-emerald-400/80">Low-risk fix automatically applied by AutoMedic policy.</div>
          </div>
        </div>
      );
    case "approved":
      return (
        <div className="p-3 rounded-lg bg-teal-950/40 border border-teal-500/40 text-teal-200 text-xs font-mono flex items-center gap-2.5">
          <WrenchIcon className="w-4 h-4 text-teal-400 shrink-0" />
          <div>
            <div className="font-bold text-teal-300">Decision: Approved by Human</div>
            <div className="text-[11px] text-teal-400/80">Operator approved the proposed fix. Workflow execution resumed.</div>
          </div>
        </div>
      );
    case "rejected":
      return (
        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-center gap-2.5">
          <XCircleIcon className="w-4 h-4 text-rose-400 shrink-0" />
          <div>
            <div className="font-bold text-rose-300">Decision: Rejected by Human</div>
            <div className="text-[11px] text-rose-400/80">Operator rejected the fix. Workflow run terminated.</div>
          </div>
        </div>
      );
    case "rejected_by_validator":
      return (
        <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-600/60 text-rose-200 text-xs font-mono flex items-center gap-2.5 shadow-[0_0_12px_rgba(244,63,94,0.2)]">
          <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0" />
          <div>
            <div className="font-bold text-rose-300">Decision: Rejected by Validator</div>
            <div className="text-[11px] text-rose-300/80">Guardrail checks failed. Automated application blocked & escalated to operator.</div>
          </div>
        </div>
      );
    case "pending":
    default:
      return (
        <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs font-mono flex items-center gap-2.5 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <AlertTriangleIcon className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="font-bold text-amber-300">Decision: Awaiting Your Approval</div>
            <div className="text-[11px] text-amber-300/80">Requires human confirmation before applying config patch.</div>
          </div>
        </div>
      );
  }
}

function ProposedFixDiff({ fix }: { fix: { type: string; params?: Record<string, unknown>; explanation?: string } }) {
  const params = fix.params || {};

  switch (fix.type) {
    case "remap_field": {
      const source = (params.source || params.from) as string;
      const target = (params.target || params.to) as string;
      return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-3 font-mono text-xs space-y-1.5">
          <div className="text-[11px] text-zinc-400 font-semibold uppercase">Field Mapping Patch:</div>
          <div className="flex items-center gap-2 text-rose-400 bg-rose-950/30 px-2 py-1 rounded">
            <span>- missing schema field:</span>
            <code className="text-white font-bold">{target}</code>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded">
            <span>+ remap from raw source:</span>
            <code className="text-white font-bold">{source}</code>
            <span className="text-zinc-400">→</span>
            <code className="text-emerald-300 font-bold">{target}</code>
          </div>
        </div>
      );
    }
    case "coerce_type": {
      const field = (params.field || "employees") as string;
      const targetType = (params.targetType || "number") as string;
      return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-3 font-mono text-xs space-y-1.5">
          <div className="text-[11px] text-zinc-400 font-semibold uppercase">Type Coercion Rule:</div>
          <div className="flex items-center gap-2 text-rose-400 bg-rose-950/30 px-2 py-1 rounded">
            <span>- raw received value:</span>
            <code className="text-white font-bold">{field} (string)</code>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded">
            <span>+ coerce target type:</span>
            <code className="text-white font-bold">{field}</code>
            <span className="text-zinc-400">→</span>
            <code className="text-emerald-300 font-bold">{targetType}</code>
          </div>
        </div>
      );
    }
    case "retry_with_backoff": {
      const maxRetries = params.maxRetries ?? 3;
      const delayMs = params.backoffMs ?? params.initialDelayMs ?? 1000;
      return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-3 font-mono text-xs space-y-1.5">
          <div className="text-[11px] text-zinc-400 font-semibold uppercase">Retry Schedule:</div>
          <div className="flex items-center justify-between text-zinc-300 bg-zinc-900 px-2 py-1 rounded">
            <span>Max Retries:</span>
            <strong className="text-purple-300">{String(maxRetries)}</strong>
          </div>
          <div className="flex items-center justify-between text-zinc-300 bg-zinc-900 px-2 py-1 rounded">
            <span>Backoff Interval:</span>
            <strong className="text-purple-300">{String(delayMs)}ms exponential</strong>
          </div>
          <div className="text-[10px] text-zinc-500 italic mt-1">
            * Honors Retry-After headers from rate limits; scaled by DEMO_TIME_SCALE.
          </div>
        </div>
      );
    }
    case "switch_to_fallback_endpoint": {
      const endpoint = (params.fallbackEndpoint || params.endpoint) as string;
      return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-3 font-mono text-xs space-y-1.5">
          <div className="text-[11px] text-zinc-400 font-semibold uppercase">Endpoint Failover:</div>
          <div className="flex items-center gap-2 text-rose-400 bg-rose-950/30 px-2 py-1 rounded">
            <span>- primary endpoint:</span>
            <code className="text-white">/api/mock/enrichment (DOWN)</code>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded">
            <span>+ healthy fallback:</span>
            <code className="text-emerald-300 font-bold">{endpoint || "/api/mock/enrichment-v2"}</code>
          </div>
        </div>
      );
    }
    case "skip_step": {
      return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-3 font-mono text-xs text-amber-300">
          Step will be marked as skipped and workflow pipeline will proceed with subsequent tasks.
        </div>
      );
    }
    default:
      return (
        <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-3 text-xs font-mono text-zinc-300 overflow-x-auto">
          {JSON.stringify(fix, null, 2)}
        </pre>
      );
  }
}

export function IncidentPanel({
  incidents,
  onActionComplete,
  onErrorToast,
  onRunTriggered,
}: IncidentPanelProps) {
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<"approve" | "reject" | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);

  const handleInjectAndRun = async () => {
    if (isInjecting) return;
    setIsInjecting(true);
    try {
      // 1. Set chaos to schema_drift
      const chaosRes = await fetch("/api/chaos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "schema_drift" }),
      });
      if (!chaosRes.ok) throw new Error("Failed to set chaos mode");

      // 2. Trigger workflow run
      const runRes = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowName: "lead_to_crm",
          lead: {
            name: "Alex Thorne",
            email: "alex@thorne-technologies.com",
            company: "Thorne Technologies",
          },
        }),
      });
      if (!runRes.ok) throw new Error("Failed to trigger run");
      const data = await runRes.json();
      onRunTriggered?.(data.runId);
      onActionComplete?.("Injected schema_drift & started lead run!");
    } catch (err: unknown) {
      onErrorToast?.(`Injection failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsInjecting(false);
    }
  };

  if (!incidents || incidents.length === 0) {
    return (
      <aside className="w-full lg:w-96 xl:w-[420px] border-l border-zinc-800 bg-zinc-950/50 flex flex-col h-full shrink-0 items-center justify-center p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
          <ShieldCheckIcon className="w-7 h-7 text-emerald-400" />
        </div>
        <h3 className="text-sm font-mono font-bold text-zinc-100 max-w-xs">
          Healthy run. Inject a failure to watch AutoMedic fix it
        </h3>
        <p className="text-xs font-mono text-zinc-400 mt-2 max-w-xs leading-relaxed">
          Workflow run executed without failure or anomaly. All steps passed output validation.
        </p>

        <button
          id="inject-failure-demo-btn"
          onClick={handleInjectAndRun}
          disabled={isInjecting}
          className="mt-6 px-4 py-2.5 rounded-lg font-mono text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-400/40 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
        >
          {isInjecting ? (
            <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <SparklesIcon className="w-3.5 h-3.5" />
          )}
          <span>Inject Schema Drift & Run Lead</span>
        </button>
      </aside>
    );
  }

  // Active incident based on tab
  const currentIncident = incidents[activeTabIdx] || incidents[0];
  const diagnosis = currentIncident.diagnosis;
  const validation = currentIncident.validationResult;
  const proposedFix = currentIncident.proposedFix || diagnosis?.proposedFix;
  const confidencePercent = diagnosis?.confidence ? Math.round(diagnosis.confidence * 100) : 0;

  const handleApprove = async () => {
    if (submittingAction) return;
    setSubmittingAction("approve");
    try {
      const res = await fetch(`/api/incidents/${currentIncident.id}/approve`, {
        method: "POST",
      });
      if (res.status === 409) {
        onErrorToast?.("Already resolved or cannot approve invalid fix.");
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        onErrorToast?.(`Approval failed: ${text}`);
        return;
      }
      onActionComplete?.("Fix approved. Resuming workflow execution.");
    } catch (err: unknown) {
      onErrorToast?.(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleReject = async () => {
    if (submittingAction) return;
    setSubmittingAction("reject");
    try {
      const res = await fetch(`/api/incidents/${currentIncident.id}/reject`, {
        method: "POST",
      });
      if (res.status === 409) {
        onErrorToast?.("Already decided or resolved.");
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        onErrorToast?.(`Rejection failed: ${text}`);
        return;
      }
      onActionComplete?.("Proposed fix rejected. Workflow run terminated.");
    } catch (err: unknown) {
      onErrorToast?.(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmittingAction(null);
    }
  };

  const isPending = currentIncident.decision === "pending";
  const isRejectedByValidator = currentIncident.decision === "rejected_by_validator";

  return (
    <aside className="w-full lg:w-96 xl:w-[420px] border-l border-zinc-800 bg-zinc-950/50 flex flex-col h-full shrink-0 overflow-y-auto">
      {/* Header & Incident Tabs */}
      <div className="p-3.5 border-b border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-purple-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono">
              Incident Diagnostics
            </h2>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
            AutoMedic Guardrail
          </span>
        </div>

        {/* Multi-incident tabs */}
        {incidents.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
            {incidents.map((inc, idx) => (
              <button
                key={inc.id || idx}
                onClick={() => setActiveTabIdx(idx)}
                className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
                  activeTabIdx === idx
                    ? "bg-purple-600 text-white font-semibold shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Incident #{idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4 text-xs font-mono">
        {/* Decision Banner */}
        <DecisionBanner decision={currentIncident.decision} />

        {/* Root Cause Callout */}
        <div className="p-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800">
          <div className="text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center justify-between">
            <span>Root Cause Diagnosis</span>
            {diagnosis?.source === "cache" ? (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold flex items-center gap-1">
                <span>⚡</span> Cached
              </span>
            ) : (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold flex items-center gap-1">
                <span>✨</span> Gemini
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-zinc-100 leading-snug">
            {diagnosis?.rootCause || "Analyzing failure telemetry..."}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-zinc-800/80">
            {diagnosis?.failureCategory && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 text-purple-300 border border-zinc-700">
                {diagnosis.failureCategory}
              </span>
            )}
            <RiskBadge risk={currentIncident.riskLevel} />
          </div>
        </div>

        {/* Confidence Meter */}
        <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/80">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
            <span>Diagnosis Confidence</span>
            <span className="font-bold text-zinc-200">{confidencePercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                confidencePercent >= 80
                  ? "bg-emerald-500"
                  : confidencePercent >= 50
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
        </div>

        {/* Proposed Fix Diff */}
        {proposedFix && (
          <div>
            <div className="text-[11px] uppercase font-semibold text-zinc-400 mb-1.5 flex items-center justify-between">
              <span>Proposed Fix ({proposedFix.type})</span>
            </div>
            <ProposedFixDiff fix={proposedFix} />
            {proposedFix.explanation && (
              <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed bg-zinc-900/30 p-2 rounded border border-zinc-900">
                {proposedFix.explanation}
              </p>
            )}
          </div>
        )}

        {/* Validation Checklist */}
        {validation && (
          <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
            <div className="text-[11px] uppercase font-semibold text-zinc-300 mb-2 flex items-center justify-between">
              <span>Guardrail Dry-Run Validation</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  validation.valid
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                }`}
              >
                {validation.valid ? "PASSED ALL CHECKS" : "CHECK FAILED"}
              </span>
            </div>
            <div className="space-y-2">
              {validation.checks.map((check, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[11px]">
                  {check.passed ? (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircleIcon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold text-zinc-200">{check.name}: </span>
                    <span className="text-zinc-400">{check.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence Monospace Quotes */}
        {diagnosis?.evidence && diagnosis.evidence.length > 0 && (
          <div>
            <div className="text-[11px] uppercase font-semibold text-zinc-400 mb-1.5">
              Captured Evidence
            </div>
            <ul className="space-y-1.5 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/80">
              {diagnosis.evidence.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-[11px] text-zinc-300">
                  <span className="text-purple-400 shrink-0">•</span>
                  <span className="leading-relaxed">
                    {item.split(/(`[^`]+`)/g).map((chunk, cIdx) =>
                      chunk.startsWith("`") && chunk.endsWith("`") ? (
                        <code
                          key={cIdx}
                          className="px-1 py-0.5 bg-purple-950/60 text-purple-300 border border-purple-800/50 rounded font-mono text-[10px]"
                        >
                          {chunk.slice(1, -1)}
                        </code>
                      ) : (
                        chunk
                      )
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Alternatives Considered (Collapsible) */}
        {diagnosis?.alternativesConsidered && diagnosis.alternativesConsidered.length > 0 && (
          <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/30">
            <button
              onClick={() => setShowAlternatives(!showAlternatives)}
              className="w-full px-3 py-2 text-left flex items-center justify-between text-[11px] font-semibold text-zinc-400 hover:text-zinc-200"
            >
              <span>Alternatives Considered ({diagnosis.alternativesConsidered.length})</span>
              {showAlternatives ? (
                <ChevronDownIcon className="w-3.5 h-3.5" />
              ) : (
                <ChevronRightIcon className="w-3.5 h-3.5" />
              )}
            </button>
            {showAlternatives && (
              <div className="p-3 border-t border-zinc-800 space-y-1.5 text-[11px] text-zinc-400">
                {diagnosis.alternativesConsidered.map((alt, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-zinc-600">-</span>
                    <span>{alt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Human In The Loop Actions (Approve / Reject) */}
        {isPending && (
          <div className="pt-2 border-t border-zinc-800 flex flex-col gap-2">
            <div className="text-[11px] text-zinc-400 font-semibold uppercase">
              Operator Decision Required:
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="approve-fix-btn"
                disabled={isRejectedByValidator || submittingAction !== null}
                onClick={handleApprove}
                title={
                  isRejectedByValidator
                    ? "Cannot approve a fix that failed guardrail validation"
                    : "Apply patch and resume workflow execution"
                }
                className={`py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  isRejectedByValidator
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                }`}
              >
                {submittingAction === "approve" ? (
                  <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                )}
                Approve Fix
              </button>

              <button
                id="reject-fix-btn"
                disabled={submittingAction !== null}
                onClick={handleReject}
                className="py-2 px-3 rounded-lg font-mono text-xs font-bold bg-rose-600/90 hover:bg-rose-500 text-white border border-rose-500/50 transition-all flex items-center justify-center gap-1.5"
              >
                {submittingAction === "reject" ? (
                  <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircleIcon className="w-3.5 h-3.5" />
                )}
                Reject
              </button>
            </div>
            {isRejectedByValidator && (
              <p className="text-[10px] text-rose-400 text-center mt-1">
                Approve is disabled because the fix failed validation guardrails.
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
