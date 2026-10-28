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
import { TestLabDrawer } from "@/components/dashboard/TestLabDrawer";
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

  // Theme Management: Light theme by default, toggle to dark
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check saved preference or default to light
    const savedTheme = localStorage.getItem("automedic_theme");
    if (savedTheme === "dark") {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("automedic_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Drawer & Modal State
  const [isTestLabOpen, setIsTestLabOpen] = useState(false);
  const [isSubmitLeadOpen, setIsSubmitLeadOpen] = useState(false);

  // Summary Row Scope: "This session" (default) vs "All time"
  const [showAllTime, setShowAllTime] = useState(false);

  // Runs List Scope: Session only vs History
  const [showHistory, setShowHistory] = useState(false);

  // User Selection
  const [userSelectedRunId, setUserSelectedRunId] = useState<string | null>(null);

  // Toast Notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // 1. Session Scoping: runs & incidents since last reset
  const sessionRuns = useMemo(() => {
    if (showHistory || !chaos?.resetAt) return runs;
    const resetTs = new Date(chaos.resetAt).getTime();
    return runs.filter((r) => new Date(r.startedAt).getTime() >= resetTs);
  }, [runs, chaos?.resetAt, showHistory]);

  const sessionIncidents = useMemo(() => {
    if (showHistory || !chaos?.resetAt) return allIncidents;
    const resetTs = new Date(chaos.resetAt).getTime();
    return allIncidents.filter((i) => new Date(i.createdAt).getTime() >= resetTs);
  }, [allIncidents, chaos?.resetAt, showHistory]);

  // Runs for summary statistics
  const summaryRuns = showAllTime ? runs : sessionRuns;
  const summaryIncidents = showAllTime ? allIncidents : sessionIncidents;

  // 2. Auto-select what matters:
  // When nothing is manually selected, select the most recent run with an incident or awaiting attention
  const priorityRunId = useMemo(() => {
    const displayRuns = sessionRuns;
    if (displayRuns.length === 0) return null;

    // 1st Priority: awaiting_approval or healing
    const attentionRun = displayRuns.find(
      (r) => r.status === "awaiting_approval" || r.status === "healing"
    );
    if (attentionRun) return attentionRun.id;

    // 2nd Priority: most recent run with an incident
    const runWithIncident = displayRuns.find((r) =>
      sessionIncidents.some((i) => i.runId === r.id) || (r.incidentCount && r.incidentCount > 0)
    );
    if (runWithIncident) return runWithIncident.id;

    // Fallback: newest run
    return displayRuns[0].id;
  }, [sessionRuns, sessionIncidents]);

  // Follow demo run if demo is running
  useEffect(() => {
    if (demo && demo.status !== "idle" && demo.runId) {
      setUserSelectedRunId(demo.runId);
    }
  }, [demo?.runId, demo?.status]);

  const activeRunId = useMemo(() => {
    const displayRuns = sessionRuns;
    if (displayRuns.length === 0) return null;

    if (demo && demo.status !== "idle" && demo.runId) {
      if (displayRuns.some((r) => r.id === demo.runId)) {
        return demo.runId;
      }
    }

    if (userSelectedRunId && displayRuns.some((r) => r.id === userSelectedRunId)) {
      return userSelectedRunId;
    }

    return priorityRunId;
  }, [sessionRuns, demo, userSelectedRunId, priorityRunId]);

  // Active run data
  const { run, loading: runLoading } = useRun(activeRunId);
  const { steps, loading: stepsLoading } = useSteps(activeRunId);
  const { incidents: runIncidents } = useIncidents(activeRunId);

  // Active incident for RunDetail
  const activeIncident = runIncidents.length > 0 ? runIncidents[0] : null;

  // Runs awaiting approval for the top banner
  const awaitingRuns = useMemo(() => {
    return sessionRuns.filter((r) => r.status === "awaiting_approval");
  }, [sessionRuns]);

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
        if (sessionRuns.length === 0) return;
        e.preventDefault();
        const currentIndex = sessionRuns.findIndex((r) => r.id === activeRunId);
        if (e.key === "ArrowDown") {
          const nextIndex = Math.min(currentIndex + 1, sessionRuns.length - 1);
          setUserSelectedRunId(sessionRuns[nextIndex].id);
        } else if (e.key === "ArrowUp") {
          const prevIndex = Math.max(currentIndex - 1, 0);
          setUserSelectedRunId(sessionRuns[prevIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sessionRuns, activeRunId]);

  // Handlers
  const handleRunSelect = (runId: string) => {
    setUserSelectedRunId(runId);
  };

  const handleRunTriggered = (newRunId: string) => {
    setUserSelectedRunId(newRunId);
    showToast(`Workflow run #${newRunId.slice(0, 8)} started.`);
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
        {/* Subtle Toast Notification */}
        {toast && (
          <div
            role="status"
            className={`fixed top-3 right-3 z-50 px-3 py-1.5 rounded-[4px] border text-[12px] font-medium shadow-md flex items-center gap-2 animate-fadeIn transition-all ${
              toast.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                : "bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* 1. Flat 48px Top Bar + 32px Connected Systems Strip with Inline Stats */}
        <Header
          isOnline={isOnline}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenTestLab={() => setIsTestLabOpen(true)}
          onOpenSubmitLead={() => setIsSubmitLeadOpen(true)}
          chaos={chaos}
          runs={summaryRuns}
          incidents={summaryIncidents}
          showAllTime={showAllTime}
          onToggleAllTime={() => setShowAllTime(!showAllTime)}
        />

        {/* 2. Slim 32px Needs-Attention Banner (when ≥1 run needs approval) */}
        <NeedsAttentionBanner
          awaitingRuns={awaitingRuns}
          incidents={sessionIncidents}
          onSelectRun={handleRunSelect}
        />

        {/* 3. Full-Bleed Flat Body: 320px Left Rail + Canvas (1px hairline divider only) */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Rail (320px): Runs List */}
          <ErrorBoundary isPanel fallbackTitle="Runs List Unavailable">
            <RunsList
              runs={sessionRuns}
              incidents={sessionIncidents}
              selectedRunId={activeRunId}
              onSelectRun={handleRunSelect}
              loading={runsLoading}
              showHistory={showHistory}
              onToggleHistory={() => setShowHistory(!showHistory)}
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
              onOpenTestLab={() => setIsTestLabOpen(true)}
              onOpenSubmitLead={() => setIsSubmitLeadOpen(true)}
            />
          </ErrorBoundary>
        </div>

        {/* Test Lab Drawer (Slide-over from right) */}
        <TestLabDrawer
          isOpen={isTestLabOpen}
          onClose={() => setIsTestLabOpen(false)}
          chaos={chaos}
          demo={demo}
          onSetChaosMode={handleSetChaosMode}
          onStartDemo={handleStartDemo}
          onSkipDemo={handleSkipDemo}
          onStopDemo={handleStopDemo}
          onReset={handleReset}
        />

        {/* Submit a Lead Modal */}
        <SubmitLeadModal
          isOpen={isSubmitLeadOpen}
          onClose={() => setIsSubmitLeadOpen(false)}
          onRunTriggered={handleRunTriggered}
          onErrorToast={(msg) => showToast(msg, "error")}
        />
      </div>
    </ErrorBoundary>
  );
}
