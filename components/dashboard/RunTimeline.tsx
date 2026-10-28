"use client";

import React, { useState } from "react";
import { WorkflowRun, StepLog } from "@/lib/types";
import {
  CheckCircleIcon,
  XCircleIcon,
  RefreshCwIcon,
  BotIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SparklesIcon,
  ClockIcon,
  FastForwardIcon,
} from "./Icons";

interface RunTimelineProps {
  run: WorkflowRun | null;
  steps: StepLog[];
  loading?: boolean;
}

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  const [copied, setCopied] = useState(false);
  const jsonStr = data ? JSON.stringify(data, null, 2) : "null";

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2 bg-zinc-950 border border-zinc-800/80 rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/60 border-b border-zinc-800 text-[10px] font-mono text-zinc-400">
        <span>{title}</span>
        <button
          onClick={handleCopy}
          className="hover:text-zinc-200 transition-colors text-[9px] uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-56 leading-relaxed selection:bg-purple-900 selection:text-white">
        {jsonStr}
      </pre>
    </div>
  );
}

export function RunTimeline({ run, steps, loading = false }: RunTimelineProps) {
  const [expandedStepIds, setExpandedStepIds] = useState<Record<string, boolean>>({});

  const toggleStep = (id: string) => {
    setExpandedStepIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (!run) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-zinc-950/30 text-zinc-500 font-mono text-xs">
        Select a workflow run from the left panel to inspect the execution timeline.
      </main>
    );
  }

  const isHealing = run.status === "healing";

  return (
    <main className="flex-1 flex flex-col h-full bg-zinc-950/20 overflow-hidden">
      {/* Run Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-100 font-mono tracking-tight">
              {run.workflowName}
            </h2>
            <span className="text-xs font-mono text-zinc-500">#{run.id}</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-400 mt-0.5 flex items-center gap-2">
            <span>Started: {new Date(run.startedAt).toLocaleTimeString()}</span>
            {run.finishedAt && (
              <>
                <span className="text-zinc-600">•</span>
                <span>Finished: {new Date(run.finishedAt).toLocaleTimeString()}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {run.currentStep && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
              Active Step: <strong className="text-purple-300">{run.currentStep}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Healing In-Progress Banner */}
      {isHealing && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-purple-950/70 via-purple-900/40 to-zinc-950 border-b border-purple-500/40 flex items-center justify-between text-xs font-mono text-purple-200 animate-pulse">
          <div className="flex items-center gap-2.5">
            <RefreshCwIcon className="w-4 h-4 animate-spin text-purple-400" />
            <span>
              <strong>AutoMedic is diagnosing & healing…</strong> SRE Agent inspecting failure telemetry
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
            Autonomous Fix In Flight
          </span>
        </div>
      )}

      {/* Timeline Steps */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {loading && steps.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-mono flex flex-col items-center gap-2">
            <RefreshCwIcon className="w-4 h-4 animate-spin text-zinc-500" />
            Loading execution steps...
          </div>
        ) : steps.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-mono">
            No steps executed yet for this run.
          </div>
        ) : (
          steps.map((step, idx) => {
            const isAutobot = step.stepName.startsWith("autobot:");
            const isExpanded = !!expandedStepIds[step.id];
            const isFailed = step.status === "failed";
            const isSkipped = step.status === "skipped";
            const isSuccess = step.status === "success";

            return (
              <div
                key={step.id || idx}
                className={`transition-all rounded-lg border ${
                  isAutobot
                    ? "ml-4 sm:ml-6 border-purple-800/50 bg-purple-950/20 shadow-[0_0_12px_rgba(168,85,247,0.1)]"
                    : isFailed
                    ? "border-rose-900/60 bg-rose-950/20"
                    : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80"
                }`}
              >
                {/* Step Card Bar */}
                <button
                  onClick={() => toggleStep(step.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    {/* Status Icon */}
                    {isAutobot ? (
                      <div className="w-6 h-6 rounded-md bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                        <BotIcon className="w-3.5 h-3.5" />
                      </div>
                    ) : isSuccess ? (
                      <CheckCircleIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : isFailed ? (
                      <XCircleIcon className="w-5 h-5 text-rose-400 shrink-0" />
                    ) : isSkipped ? (
                      <FastForwardIcon className="w-5 h-5 text-zinc-400 shrink-0" />
                    ) : (
                      <ClockIcon className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                    )}

                    {/* Step Title & Badge */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs font-semibold ${
                            isAutobot
                              ? "text-purple-300"
                              : isFailed
                              ? "text-rose-200"
                              : "text-zinc-200"
                          }`}
                        >
                          {step.stepName}
                        </span>
                        {isAutobot && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                            AUTOMEDIC AGENT
                          </span>
                        )}
                        {isSkipped && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            SKIPPED BY FIX
                          </span>
                        )}
                        {step.stepName === "send_followup" &&
                          (step.request as Record<string, unknown>)?.mode === "real" && (
                            <span
                              id={`real-email-badge-${step.id}`}
                              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse"
                            >
                              <span>✉️</span> Real email sent
                            </span>
                        )}
                        {step.stepName === "send_followup" &&
                          (step.request as Record<string, unknown>)?.mode === "mock" && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                              MOCK EMAIL
                            </span>
                        )}
                      </div>
                      {step.errorMessage && (
                        <p className="text-[11px] font-mono text-rose-300 mt-1 max-w-lg line-clamp-1">
                          {step.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right metadata & expand icon */}
                  <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 shrink-0">
                    {step.durationMs > 0 && <span>{step.durationMs}ms</span>}
                    {isExpanded ? (
                      <ChevronDownIcon className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>
                </button>

                {/* Collapsible Payload Inspection */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60 bg-zinc-950/40">
                    {step.errorMessage && (
                      <div className="mb-3 p-2.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-200 text-xs font-mono">
                        <div className="font-bold text-[10px] uppercase text-rose-400 mb-0.5">
                          Error Code: {String(step.errorCode || "UNSPECIFIED")}
                        </div>
                        {step.errorMessage}
                      </div>
                    )}

                    {step.request !== null && step.request !== undefined && (
                      <JsonBlock title="Captured Request / Trigger" data={step.request} />
                    )}

                    {step.response !== null && step.response !== undefined && (
                      <JsonBlock title="Raw Response / Agent Artifact" data={step.response} />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
