"use client";

import React, { useState } from "react";
import { ChaosMode, ChaosConfig } from "@/lib/types";
import { PlayIcon, RefreshCwIcon, SparklesIcon, ChevronDownIcon, ChevronUpIcon } from "./Icons";

interface ChaosBarProps {
  chaos: ChaosConfig | null;
  onRunTriggered?: (runId: string) => void;
  onChaosChanged?: (mode: ChaosMode) => void;
  onErrorToast?: (error: string) => void;
  onResetTriggered?: () => void;
}

const CHAOS_MODES: { mode: ChaosMode; label: string; tooltip: string }[] = [
  {
    mode: "none",
    label: "None (Healthy)",
    tooltip: "Normal operation: all mock APIs return healthy 200 responses with expected schemas.",
  },
  {
    mode: "schema_drift",
    label: "Schema Drift",
    tooltip: "Upstream renamed 'employees' to 'staff_count'. AutoMedic diagnoses and auto-applies remap_field.",
  },
  {
    mode: "transient_500",
    label: "Transient 500",
    tooltip: "Simulates two consecutive 500 server errors before recovery. AutoMedic applies retry_with_backoff.",
  },
  {
    mode: "rate_limit",
    label: "Rate Limit (429)",
    tooltip: "Simulates 429 Too Many Requests with Retry-After header. AutoMedic respects retry schedule.",
  },
  {
    mode: "bad_type",
    label: "Bad Type",
    tooltip: "API returns string '1500' instead of number. Escalates to human for approve/coerce confirmation.",
  },
  {
    mode: "primary_down",
    label: "Primary Down",
    tooltip: "Primary enrichment API times out. AutoMedic automatically switches to healthy /v2 fallback endpoint.",
  },
  {
    mode: "bad_fix_trap",
    label: "Bad Fix Trap",
    tooltip: "Response includes deprecated decoy field 'employee_count_old'. Guardrail rejects auto-apply and escalates.",
  },
];

export function getChaosStatusChip(chaos: ChaosConfig | null): { text: string; isHealthy: boolean } {
  const mode = (chaos?.mode as ChaosMode) || "none";
  const counters = chaos?.counters || {};

  if (mode === "none") {
    return {
      text: "Healthy mode: next run will succeed",
      isHealthy: true,
    };
  }

  if (mode === "transient_500") {
    const count = counters["transient_500"] || 0;
    const left = Math.max(0, 2 - count);
    if (left === 0) {
      return {
        text: "Transient 500: fails 2 calls, then recovers (0 of 2 left, now healthy)",
        isHealthy: true,
      };
    }
    return {
      text: `Transient 500: fails 2 calls, then recovers (${left} of 2 left, active)`,
      isHealthy: false,
    };
  }

  if (mode === "rate_limit") {
    const count = counters["rate_limit"] || 0;
    const left = Math.max(0, 2 - count);
    if (left === 0) {
      return {
        text: "Rate Limit (429): limits 2 calls, then recovers (0 of 2 left, now healthy)",
        isHealthy: true,
      };
    }
    return {
      text: `Rate Limit (429): limits 2 calls, then recovers (${left} of 2 left, active)`,
      isHealthy: false,
    };
  }

  if (mode === "schema_drift") {
    return {
      text: "Schema Drift: renames 'employees' → 'staff_count' (AutoMedic will auto-remap)",
      isHealthy: false,
    };
  }

  if (mode === "bad_type") {
    return {
      text: "Bad Type: returns string 'approx 50' instead of number (Escalates for approval)",
      isHealthy: false,
    };
  }

  if (mode === "primary_down") {
    return {
      text: "Primary Down: 503 cluster offline (AutoMedic will failover to v2)",
      isHealthy: false,
    };
  }

  if (mode === "bad_fix_trap") {
    return {
      text: "Bad Fix Trap: decoy legacy field present (Validator must reject fix)",
      isHealthy: false,
    };
  }

  return {
    text: "Healthy mode: next run will succeed",
    isHealthy: true,
  };
}

export function ChaosBar({
  chaos,
  onRunTriggered,
  onChaosChanged,
  onErrorToast,
  onResetTriggered,
}: ChaosBarProps) {
  const [isTriggeringRun, setIsTriggeringRun] = useState(false);
  const [isChangingChaos, setIsChangingChaos] = useState(false);
  const [isStartingDemo, setIsStartingDemo] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const activeMode: ChaosMode = (chaos?.mode as ChaosMode) || "none";
  const statusChip = getChaosStatusChip(chaos);

  const handleSetMode = async (mode: ChaosMode) => {
    if (isChangingChaos || mode === activeMode) return;
    setIsChangingChaos(true);
    try {
      const res = await fetch("/api/chaos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        throw new Error("Failed to set chaos mode");
      }
      onChaosChanged?.(mode);
    } catch (err: unknown) {
      onErrorToast?.(`Failed to update chaos mode: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsChangingChaos(false);
    }
  };

  const handleReset = async () => {
    setIsChangingChaos(true);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to reset system");
      }
      onChaosChanged?.("none");
      onResetTriggered?.();
    } catch (err: unknown) {
      onErrorToast?.(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsChangingChaos(false);
    }
  };

  const handleRunDemo = async () => {
    if (isStartingDemo) return;
    setIsStartingDemo(true);
    try {
      const res = await fetch("/api/demo/start", {
        method: "POST",
      });
      if (res.status === 409) {
        onErrorToast?.("A demo run is already in progress.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start demo sequence");
      }
    } catch (err: unknown) {
      onErrorToast?.(`Failed to start demo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsStartingDemo(false);
    }
  };

  const handleRunNewLead = async () => {
    if (isTriggeringRun) return;
    setIsTriggeringRun(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowName: "lead_to_crm",
          lead: {
            name: "Devon Vance",
            email: "devon@vance-biotech.com",
            company: "Vance Biotech",
          },
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to start workflow run");
      }
      const data = await res.json();
      onRunTriggered?.(data.runId);
    } catch (err: unknown) {
      onErrorToast?.(`Failed to trigger workflow: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsTriggeringRun(false);
    }
  };

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950/95 sticky bottom-0 z-20 shadow-[0_-8px_20px_rgba(0,0,0,0.5)]">
      {/* Collapsed Advanced Controls Drawer: Test Lab (fault injection) */}
      {isAdvancedOpen && (
        <div
          id="advanced-controls-drawer"
          className="border-b border-zinc-800 bg-zinc-900/80 p-3.5 space-y-2.5 animate-fadeIn"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider">
                Test Lab (fault injection)
              </span>
              <span className="text-[11px] text-zinc-400">
                Failures are proxy-injected over active services (enrichment, CRM, email) to verify autonomous healing &amp; guardrails.
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
              Fault Injection Proxy Active
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono font-semibold text-zinc-400 mr-2 flex items-center gap-1">
                <span>Select Fault Mode:</span>
              </span>
              {CHAOS_MODES.map((item) => {
                const isActive = item.mode === activeMode;
                return (
                  <button
                    key={item.mode}
                    id={`chaos-btn-${item.mode}`}
                    title={item.tooltip}
                    onClick={() => handleSetMode(item.mode)}
                    disabled={isChangingChaos}
                    className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all relative flex items-center gap-1.5 ${
                      isActive
                        ? item.mode === "none"
                          ? "bg-emerald-600 text-white font-bold shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                          : "bg-purple-600 text-white font-bold shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                        : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                    }`}
                  >
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                    {item.label}
                  </button>
                );
              })}
            </div>

            <button
              id="run-new-lead-btn"
              onClick={handleRunNewLead}
              disabled={isTriggeringRun}
              className="px-3.5 py-1 text-xs font-mono font-semibold rounded-md bg-purple-600/90 hover:bg-purple-500 text-white transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)] flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
            >
              {isTriggeringRun ? (
                <RefreshCwIcon className="w-3 h-3 animate-spin" />
              ) : (
                <PlayIcon className="w-3 h-3 fill-current" />
              )}
              Run Lead via Proxy
            </button>
          </div>
        </div>
      )}

      {/* Main Simplified Controls Row */}
      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Chaos Status Chip */}
        <div className="flex items-center gap-2">
          <div
            id="chaos-status-chip"
            className={`px-3 py-1.5 rounded-full border text-xs font-mono flex items-center gap-2 transition-all shadow-sm ${
              statusChip.isHealthy
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                : "bg-purple-950/40 border-purple-500/50 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)]"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  statusChip.isHealthy ? "bg-emerald-400" : "bg-purple-400"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  statusChip.isHealthy ? "bg-emerald-500" : "bg-purple-500"
                }`}
              />
            </span>
            <span className="font-medium tracking-tight">{statusChip.text}</span>
          </div>
        </div>

        {/* Primary Action Buttons: Run Demo, Reset, Advanced Drawer Toggle */}
        <div className="flex items-center gap-2.5">
          {/* PRIMARY BUTTON: Run Demo */}
          <button
            id="run-demo-btn"
            onClick={handleRunDemo}
            disabled={isStartingDemo}
            className="px-5 py-2 text-xs font-mono font-bold rounded-lg bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-white transition-all shadow-[0_0_20px_rgba(245,158,11,0.45)] border border-amber-400/40 flex items-center gap-2 disabled:opacity-50 active:scale-95"
          >
            {isStartingDemo ? (
              <RefreshCwIcon className="w-4 h-4 animate-spin" />
            ) : (
              <SparklesIcon className="w-4 h-4 text-white" />
            )}
            <span>Run Demo</span>
          </button>

          {/* Reset (Always visible) */}
          <button
            id="reset-chaos-btn"
            onClick={handleReset}
            disabled={isChangingChaos}
            className="px-3.5 py-2 text-xs font-mono font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors disabled:opacity-50"
          >
            Reset
          </button>

          {/* Test Lab (Fault Injection) Collapsible Drawer Button */}
          <button
            id="advanced-controls-toggle-btn"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`px-3 py-2 text-xs font-mono rounded-lg transition-colors border flex items-center gap-1.5 ${
              isAdvancedOpen
                ? "bg-purple-950/70 text-purple-200 border-purple-700/60 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800"
            }`}
          >
            <span>Test Lab (fault injection)</span>
            {isAdvancedOpen ? (
              <ChevronUpIcon className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>

        </div>
      </div>
    </footer>
  );
}
