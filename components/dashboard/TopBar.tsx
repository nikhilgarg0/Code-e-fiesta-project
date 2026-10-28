import React, { useState, useEffect } from "react";
import { WorkflowRun, Incident, DemoState } from "@/lib/types";
import {
  ShieldCheckIcon,
  AlertTriangleIcon,
  WrenchIcon,
  BotIcon,
  ClockIcon,
  CheckCircleIcon,
  UploadIcon,
  ExternalLinkIcon,
  ServerIcon,
} from "./Icons";
import { IntegrationStatus } from "@/lib/integrations/status";

interface TopBarProps {
  runs: WorkflowRun[];
  incidents: Incident[];
  permissionError?: boolean;
  isOnline?: boolean;
  demo?: DemoState | null;
  onSkipDemo?: () => void;
  onStopDemo?: () => void;
  showHistory?: boolean;
  onOpenCsvImport?: () => void;
}

export function TopBar({
  runs,
  incidents,
  permissionError,
  isOnline = true,
  demo,
  onSkipDemo,
  onStopDemo,
  showHistory = false,
  onOpenCsvImport,
}: TopBarProps) {
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((data) => {
        if (isMounted) setIntegrations(data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const sessionRunsCount = runs.length;

  // 2. Auto-healed count
  const autoHealedCount = incidents.filter(
    (i) => i.resolvedBy === "auto" || (i.outcome === "recovered" && i.decision === "auto_applied")
  ).length;

  // 3. Human-approved count
  const humanApprovedCount = incidents.filter(
    (i) => i.resolvedBy === "human" && (i.decision === "approved" || i.outcome === "recovered")
  ).length;

  // 4. Awaiting approval count
  const awaitingCount = runs.filter(
    (r) => r.status === "awaiting_approval"
  ).length;

  // 5. Mean time to recovery (MTTR in seconds)
  const resolvedWithTimings = incidents.filter(
    (i) => i.resolvedAt && (i.detectedAt || i.createdAt)
  );

  let mttrText = "-";
  if (resolvedWithTimings.length > 0) {
    const totalDiffMs = resolvedWithTimings.reduce((acc, inc) => {
      const start = new Date(inc.detectedAt || inc.createdAt).getTime();
      const end = new Date(inc.resolvedAt!).getTime();
      const diff = Math.max(0, end - start);
      return acc + diff;
    }, 0);
    const avgSec = (totalDiffMs / resolvedWithTimings.length / 1000).toFixed(1);
    mttrText = `${avgSec}s`;
  }

  const isDemoActive = demo && demo.status !== "idle";

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-5 py-3 sticky top-0 z-30">
      {/* Demo Mode Progress Strip */}
      {isDemoActive && (
        <div
          id="demo-progress-strip"
          className={`mb-3 px-4 py-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-3 shadow-lg transition-all ${
            demo.status === "paused"
              ? "bg-amber-950/70 border-amber-500/60 text-amber-200"
              : demo.status === "completed"
              ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-200"
              : "bg-purple-950/70 border-purple-500/60 text-purple-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                demo.status === "paused" ? "bg-amber-400" : demo.status === "completed" ? "bg-emerald-400" : "bg-purple-400"
              }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                demo.status === "paused" ? "bg-amber-500" : demo.status === "completed" ? "bg-emerald-500" : "bg-purple-500"
              }`} />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-mono font-bold tracking-tight">
                {demo.label || `Demo Step ${demo.step} of ${demo.totalSteps}`}
              </span>
              {demo.actionPrompt && (
                <span className="text-[11px] font-sans font-medium text-amber-300 mt-0.5 animate-pulse">
                  {demo.actionPrompt}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {demo.status !== "completed" && (
              <button
                id="demo-skip-step-btn"
                onClick={onSkipDemo}
                className="px-2.5 py-1 text-[11px] font-mono rounded bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 transition-colors"
              >
                Skip step
              </button>
            )}
            <button
              id="demo-stop-btn"
              onClick={onStopDemo}
              className="px-2.5 py-1 text-[11px] font-mono rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition-colors"
            >
              Stop demo
            </button>
          </div>
        </div>
      )}

      {/* Demo Summary Card on Completion */}
      {demo && demo.status === "completed" && demo.summary && (
        <div
          id="demo-summary-card"
          className="mb-3 p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-mono font-bold text-emerald-200">
                Demo Run Sequence Completed Successfully
              </h2>
              <p className="text-[11px] text-zinc-400">
                All 6 chaos scenarios evaluated with autonomous guardrail enforcement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="px-3 py-1 bg-zinc-900/80 rounded border border-zinc-800">
              <span className="text-zinc-400">Runs: </span>
              <span className="text-white font-bold">{demo.summary.runs ?? 0}</span>
            </div>
            <div className="px-3 py-1 bg-zinc-900/80 rounded border border-zinc-800">
              <span className="text-purple-400">Auto-Healed: </span>
              <span className="text-purple-300 font-bold">{demo.summary.autoHealed ?? 0}</span>
            </div>
            <div className="px-3 py-1 bg-zinc-900/80 rounded border border-zinc-800">
              <span className="text-teal-400">Human-Approved: </span>
              <span className="text-teal-300 font-bold">{demo.summary.humanApproved ?? 0}</span>
            </div>
            <div className="px-3 py-1 bg-zinc-900/80 rounded border border-zinc-800">
              <span className="text-rose-400">Validator Rejected: </span>
              <span className="text-rose-300 font-bold">{demo.summary.rejectedByValidator ?? 0}</span>
            </div>
            <div className="px-3 py-1 bg-zinc-900/80 rounded border border-zinc-800">
              <span className="text-emerald-400">MTTR: </span>
              <span className="text-emerald-300 font-bold">{demo.summary.meanTimeToRecovery || "0.0s"}</span>
            </div>
          </div>
        </div>
      )}

      {permissionError && (
        <div className="mb-3 px-4 py-2 bg-rose-950/80 border border-rose-700/60 rounded-lg text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Firestore Permission Alert:</strong> Client SDK encountered permission-denied. Please check your Firestore security rules.
            </span>
          </div>
          <span className="text-[10px] font-mono text-rose-400">auth/rules required</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Realtime Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-zinc-100 tracking-tight flex items-center gap-1.5">
                AutoMedic
                <span className="text-[10px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 font-semibold">
                  Self-Healing AI Runtime
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isOnline ? "bg-emerald-400" : "bg-rose-400"
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  isOnline ? "bg-emerald-500" : "bg-rose-500"
                }`} />
              </span>
              <span className={`font-mono text-[11px] font-semibold ${
                isOnline ? "text-emerald-400" : "text-rose-400"
              }`}>
                {isOnline ? "ONLINE (FIRESTORE)" : "OFFLINE (DISCONNECTED)"}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-[11px] text-zinc-400">Autonomous Operations Console</span>
            </div>
          </div>
        </div>

        {/* Integrations Status & Real Triggers */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            id="integrations-status-card"
            className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono"
          >
            <div className="flex items-center gap-1.5 text-zinc-400 mr-1" title="Active service integrations status">
              <ServerIcon className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hidden sm:inline">
                Services:
              </span>
            </div>

            {/* Enrichment */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800/80"
              title={integrations?.enrichment.detail || "Enrichment Service"}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  integrations?.enrichment.isLive
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                    : "bg-zinc-500"
                }`}
              />
              <span className="text-[10px] text-zinc-300">
                Enrich:{" "}
                <strong
                  className={
                    integrations?.enrichment.isLive ? "text-emerald-300 font-bold" : "text-zinc-400"
                  }
                >
                  {integrations?.enrichment.label || "Mock"}
                </strong>
              </span>
            </div>

            {/* CRM */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800/80"
              title={integrations?.crm.detail || "CRM Integration"}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  integrations?.crm.isLive
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                    : "bg-zinc-500"
                }`}
              />
              <span className="text-[10px] text-zinc-300">
                CRM:{" "}
                <strong
                  className={
                    integrations?.crm.isLive ? "text-emerald-300 font-bold" : "text-zinc-400"
                  }
                >
                  {integrations?.crm.label || "Mock"}
                </strong>
              </span>
            </div>

            {/* Email */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800/80"
              title={integrations?.email.detail || "Email Dispatcher"}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  integrations?.email.isLive
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                    : "bg-zinc-500"
                }`}
              />
              <span className="text-[10px] text-zinc-300">
                Email:{" "}
                <strong
                  className={
                    integrations?.email.isLive ? "text-emerald-300 font-bold" : "text-zinc-400"
                  }
                >
                  {integrations?.email.label || "Mock"}
                </strong>
              </span>
            </div>
          </div>

          {/* Quick Triggers */}
          <div className="flex items-center gap-1.5">
            <button
              id="import-csv-btn"
              onClick={onOpenCsvImport}
              className="px-2.5 py-1.5 text-xs font-mono font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Upload CSV of up to 50 leads with batch concurrency limit"
            >
              <UploadIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>Import CSV</span>
            </button>

            <a
              id="open-lead-form-link"
              href="/lead"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 text-xs font-mono font-medium rounded-lg bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 border border-purple-700/50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Open public lead submission form"
            >
              <span>Public /lead</span>
              <ExternalLinkIcon className="w-3.5 h-3.5 text-purple-400" />
            </a>
          </div>
        </div>

        {/* 5 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* Card 1: Session Runs */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-1.5 min-w-[110px]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              {showHistory ? "All Runs" : "This Session"}
            </div>
            <div className="text-lg font-bold text-zinc-100 mt-0.5 font-mono">
              {sessionRunsCount}
            </div>
          </div>

          {/* Card 2: Auto-Healed */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-1.5 min-w-[110px]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-purple-400 flex items-center gap-1">
              <BotIcon className="w-3 h-3 text-purple-400" />
              Auto-Healed
            </div>
            <div className="text-lg font-bold text-purple-300 mt-0.5 font-mono">
              {autoHealedCount}
            </div>
          </div>

          {/* Card 3: Human-Approved */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-1.5 min-w-[110px]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-teal-400 flex items-center gap-1">
              <WrenchIcon className="w-3 h-3 text-teal-400" />
              Human-Approved
            </div>
            <div className="text-lg font-bold text-teal-300 mt-0.5 font-mono">
              {humanApprovedCount}
            </div>
          </div>

          {/* Card 4: Awaiting Approval (Pulsing Amber) */}
          <div
            className={`border rounded-lg px-3 py-1.5 min-w-[125px] transition-all ${
              awaitingCount > 0
                ? "bg-amber-950/40 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse"
                : "bg-zinc-900/80 border-zinc-800"
            }`}
          >
            <div
              className={`text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 ${
                awaitingCount > 0 ? "text-amber-400 font-semibold" : "text-zinc-400"
              }`}
            >
              <AlertTriangleIcon className="w-3 h-3 text-amber-400" />
              Awaiting Appr.
            </div>
            <div
              className={`text-lg font-bold mt-0.5 font-mono ${
                awaitingCount > 0 ? "text-amber-300" : "text-zinc-400"
              }`}
            >
              {awaitingCount}
            </div>
          </div>

          {/* Card 5: MTTR */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-1.5 min-w-[110px]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <ClockIcon className="w-3 h-3 text-emerald-400" />
              MTTR
            </div>
            <div className="text-lg font-bold text-emerald-300 mt-0.5 font-mono">
              {mttrText}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
