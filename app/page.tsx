"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  useRuns,
  useRun,
  useSteps,
  useIncidents,
  useAllIncidents,
  useChaos,
  useDemo,
  useFirestoreConnectivity,
} from "@/lib/firebase/hooks";
import { Header } from "@/components/dashboard/Header";
import { SummaryRow } from "@/components/dashboard/SummaryRow";
import { NeedsAttentionBanner } from "@/components/dashboard/NeedsAttentionBanner";
import { RunsList } from "@/components/dashboard/RunsList";
import { RunDetail } from "@/components/dashboard/RunDetail";
import { SubmitLeadModal } from "@/components/dashboard/SubmitLeadModal";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { CheckCircleIcon, AlertTriangleIcon } from "@/components/dashboard/Icons";
import { ChaosMode } from "@/lib/types";

export default function DashboardPage() {
  // Realtime Firestore Hooks
  const { runs, loading: runsLoading } = useRuns();
  const { incidents: allIncidents } = useAllIncidents();
  const { chaos } = useChaos();
  const { demo } = useDemo();
  const isOnline = useFirestoreConnectivity();

  // Default to Dark Theme permanently
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Modal State: Open Submit Lead popup by default on landing
  const [isSubmitLeadOpen, setIsSubmitLeadOpen] = useState(true);

  // Workflow Completed Popup State
  const [completedLeadInfo, setCompletedLeadInfo] = useState<{
    name: string;
    email: string;
    company: string;
    runId: string;
  } | null>(null);

  const monitoredRunIdRef = React.useRef<string | null>(null);
  const completedRunIdsRef = React.useRef<Set<string>>(new Set());
  const prevStatusRef = React.useRef<string | null>(null);

  // User Selection
  const [userSelectedRunId, setUserSelectedRunId] = useState<string | null>(null);

  // Toast Notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // 1. Auto-select what matters from all leads:
  // When nothing is manually selected, select the most recent run with an incident or awaiting attention
  const priorityRunId = useMemo(() => {
    if (runs.length === 0) return null;

    // 1st Priority: awaiting_approval or healing
    const attentionRun = runs.find(
      (r) => r.status === "awaiting_approval" || r.status === "healing"
    );
    if (attentionRun) return attentionRun.id;

    // 2nd Priority: most recent run with an incident
    const runWithIncident = runs.find((r) =>
      allIncidents.some((i) => i.runId === r.id) || (r.incidentCount && r.incidentCount > 0)
    );
    if (runWithIncident) return runWithIncident.id;

    // Fallback: newest run
    return runs[0].id;
  }, [runs, allIncidents]);

  // Follow demo run if demo is running
  useEffect(() => {
    if (demo && demo.status !== "idle" && demo.runId) {
      setUserSelectedRunId(demo.runId);
    }
  }, [demo?.runId, demo?.status]);

  const activeRunId = useMemo(() => {
    if (runs.length === 0) return null;

    if (demo && demo.status !== "idle" && demo.runId) {
      if (runs.some((r) => r.id === demo.runId)) {
        return demo.runId;
      }
    }

    if (userSelectedRunId && runs.some((r) => r.id === userSelectedRunId)) {
      return userSelectedRunId;
    }

    return priorityRunId;
  }, [runs, demo, userSelectedRunId, priorityRunId]);

  // Active run data
  const { run, loading: runLoading } = useRun(activeRunId);
  const { steps, loading: stepsLoading } = useSteps(activeRunId);
  const { incidents: runIncidents } = useIncidents(activeRunId);

  // Active incident for RunDetail
  const activeIncident = runIncidents.length > 0 ? runIncidents[0] : null;

  // Track workflow completion to show celebration popup
  useEffect(() => {
    if (!run) {
      prevStatusRef.current = null;
      return;
    }

    const prevStatus = prevStatusRef.current;
    const currentStatus = run.status;
    prevStatusRef.current = currentStatus;

    // Trigger celebration popup when monitored run or active run finishes successfully
    const isMonitored = monitoredRunIdRef.current === run.id;
    const wasActive = prevStatus === "running" || prevStatus === "healing";
    const isCompleted = currentStatus === "success" || currentStatus === "healed";

    if ((isMonitored || wasActive) && isCompleted && !completedRunIdsRef.current.has(run.id)) {
      completedRunIdsRef.current.add(run.id);
      monitoredRunIdRef.current = null;
      const name = (run.inputPayload?.name as string) || "Lead";
      const email = (run.inputPayload?.email as string) || "";
      const company = (run.inputPayload?.company as string) || "";
      setCompletedLeadInfo({
        name,
        email,
        company,
        runId: run.id,
      });
    }
  }, [run?.status, run?.id, run?.inputPayload]);

  // Runs awaiting approval for the top banner
  const awaitingRuns = useMemo(() => {
    return runs.filter((r) => r.status === "awaiting_approval");
  }, [runs]);

  // Keyboard navigation: ArrowUp / ArrowDown to navigate runs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (runs.length === 0) return;
        e.preventDefault();
        const currentIndex = runs.findIndex((r) => r.id === activeRunId);
        if (e.key === "ArrowDown") {
          const nextIndex = Math.min(currentIndex + 1, runs.length - 1);
          setUserSelectedRunId(runs[nextIndex].id);
        } else if (e.key === "ArrowUp") {
          const prevIndex = Math.max(currentIndex - 1, 0);
          setUserSelectedRunId(runs[prevIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runs, activeRunId]);

  // Handlers
  const handleRunSelect = (runId: string) => {
    setUserSelectedRunId(runId);
  };

  const handleRunTriggered = (newRunId: string) => {
    setUserSelectedRunId(newRunId);
    monitoredRunIdRef.current = newRunId;
    showToast(`Workflow execution started.`);
  };

  const handleApproveFix = async (incidentId: string) => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/approve`, {
        method: "POST",
      });
      if (res.status === 409) {
        showToast("Already resolved or cannot approve invalid fix.", "error");
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        showToast(`Approval failed: ${text}`, "error");
        return;
      }
      showToast("Fix approved. Resuming workflow execution.", "success");
    } catch (err: unknown) {
      showToast(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        "error"
      );
    }
  };

  const handleRejectFix = async (incidentId: string) => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/reject`, {
        method: "POST",
      });
      if (res.status === 409) {
        showToast("Already decided or resolved.", "error");
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        showToast(`Rejection failed: ${text}`, "error");
        return;
      }
      showToast("Fix rejected. Workflow terminated.", "success");
    } catch (err: unknown) {
      showToast(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        "error"
      );
    }
  };

  const handleSetChaosMode = async (mode: ChaosMode) => {
    try {
      const res = await fetch("/api/chaos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        throw new Error("Failed to set fault mode");
      }
      showToast(`Fault scenario set to '${mode}'.`, "success");
    } catch (err: unknown) {
      showToast(
        `Failed to set fault mode: ${err instanceof Error ? err.message : String(err)}`,
        "error"
      );
    }
  };

  const handleStartDemo = async () => {
    try {
      const res = await fetch("/api/demo/start", { method: "POST" });
      if (res.status === 409) {
        showToast("A guided demo is already running.", "error");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start demo sequence");
      }
      showToast("Guided demo started. AutoMedic is demonstrating self-healing.", "success");
    } catch (err: unknown) {
      showToast(
        `Failed to start demo: ${err instanceof Error ? err.message : String(err)}`,
        "error"
      );
    }
  };

  const handleSkipDemo = async () => {
    try {
      const res = await fetch("/api/demo/skip", { method: "POST" });
      if (res.ok) {
        showToast("Skipped to next demo step.", "success");
      }
    } catch {
      showToast("Failed to skip demo step", "error");
    }
  };

  const handleStopDemo = async () => {
    try {
      const res = await fetch("/api/demo/stop", { method: "POST" });
      if (res.ok) {
        showToast("Guided demo stopped.", "success");
      }
    } catch {
      showToast("Failed to stop demo", "error");
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset system");
      setUserSelectedRunId(null);
      showToast("System reset: past runs and incidents purged.", "success");
    } catch (err: unknown) {
      showToast(
        `Reset failed: ${err instanceof Error ? err.message : String(err)}`,
        "error"
      );
    }
  };

  return (
    <ErrorBoundary fallbackTitle="AutoMedic Console Recovered">
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] font-sans antialiased">
        {/* Apple Dynamic Notification Capsule */}
        {toast && (
          <div
            role="status"
            className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-full apple-glass border shadow-lg text-[12.5px] font-semibold flex items-center gap-2.5 animate-fadeIn transition-all ${
              toast.type === "success"
                ? "border-emerald-500/30 text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/15"
                : "border-rose-500/30 text-rose-800 dark:text-rose-300 bg-rose-500/10 dark:bg-rose-500/15"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* 1. Flat 48px Top Bar + 32px Connected Systems Strip with Inline Stats */}
        <Header
          isOnline={isOnline}
          onOpenSubmitLead={() => setIsSubmitLeadOpen(true)}
          chaos={chaos}
          runs={runs}
          incidents={allIncidents}
        />

        {/* 2. Slim 32px Needs-Attention Banner (when ≥1 run needs approval) */}
        <NeedsAttentionBanner
          awaitingRuns={awaitingRuns}
          incidents={allIncidents}
          onSelectRun={handleRunSelect}
        />

        {/* 3. Full-Bleed Flat Body: 320px Left Rail + Canvas (1px hairline divider only) */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Rail (320px): Runs List — All Lead History */}
          <ErrorBoundary isPanel fallbackTitle="Runs List Unavailable">
            <RunsList
              runs={runs}
              incidents={allIncidents}
              selectedRunId={activeRunId}
              onSelectRun={handleRunSelect}
              loading={runsLoading}
            />
          </ErrorBoundary>

          {/* Right Rail: Canvas & Execution Graph */}
          <ErrorBoundary isPanel fallbackTitle="Workflow Canvas Unavailable">
            <RunDetail
              run={run}
              steps={steps}
              incident={activeIncident}
              loading={runLoading || stepsLoading}
              onApproveFix={handleApproveFix}
              onRejectFix={handleRejectFix}
              onOpenSubmitLead={() => setIsSubmitLeadOpen(true)}
            />
          </ErrorBoundary>
        </div>

        {/* Submit a Lead Modal */}
        <SubmitLeadModal
          isOpen={isSubmitLeadOpen}
          onClose={() => setIsSubmitLeadOpen(false)}
          onRunTriggered={handleRunTriggered}
          onErrorToast={(msg) => showToast(msg, "error")}
        />

        {/* Workflow Completed Celebration Popup */}
        {completedLeadInfo && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/75 backdrop-blur-md animate-fadeIn select-none"
            onClick={() => setCompletedLeadInfo(null)}
          >
            <div
              className="w-full max-w-md rounded-3xl apple-glass border border-emerald-500/30 shadow-2xl p-7 text-center transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Apple Celebration Squircle */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto mb-4 shadow-lg ring-8 ring-emerald-500/10">
                <CheckCircleIcon className="w-8 h-8" />
              </div>

              <h3 className="text-[19px] font-bold text-[var(--text-primary)] tracking-tight">
                Your lead has been registered
              </h3>

              <p className="text-[13.5px] text-[var(--text-secondary)] mt-1.5 font-medium leading-relaxed">
                Check your mail for confirmation
              </p>

              {Boolean(completedLeadInfo.email) && (
                <div className="my-5 p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] text-left text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span>Recipient Email:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-mono">{completedLeadInfo.email}</span>
                  </div>
                  {Boolean(completedLeadInfo.name) && (
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                      <span>Contact Name:</span>
                      <span className="font-semibold text-[var(--text-primary)]">{completedLeadInfo.name}</span>
                    </div>
                  )}
                  {Boolean(completedLeadInfo.company) && (
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                      <span>Company:</span>
                      <span className="font-semibold text-[var(--text-primary)]">{completedLeadInfo.company}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold pt-1 border-t border-[var(--border-subtle)]">
                    <span>Workflow Status:</span>
                    <span>Enriched & Synced to CRM</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => setCompletedLeadInfo(null)}
                className="w-full h-10 rounded-full bg-gradient-to-b from-[#0077ED] to-[#0066CC] hover:from-[#0082FF] hover:to-[#0070E0] text-white font-semibold text-xs shadow-sm transition-all active:scale-95 cursor-pointer mt-1"
              >
                View Workflow Execution
              </button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
