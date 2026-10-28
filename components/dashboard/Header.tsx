// components/dashboard/Header.tsx
"use client";

import React from "react";
import { ShieldCheckIcon, PlusIcon } from "./Icons";
import { ChaosConfig, WorkflowRun, Incident } from "@/lib/types";

interface HeaderProps {
  isOnline?: boolean;
  onOpenSubmitLead: () => void;
  chaos?: ChaosConfig | null;
  runs?: WorkflowRun[];
  incidents?: Incident[];
  showAllTime?: boolean;
  onToggleAllTime?: () => void;
}

export function Header({
  isOnline = true,
  onOpenSubmitLead,
  chaos,
  runs = [],
  incidents = [],
  showAllTime = false,
  onToggleAllTime,
}: HeaderProps) {
  const isChaosActive = chaos?.mode && chaos.mode !== "none";

  // Calculate stats for quiet inline display
  const totalRuns = runs.length;
  const autoHealedCount = incidents.filter(
    (i) => i.resolvedBy === "auto" || (i.outcome === "recovered" && i.decision === "auto_applied")
  ).length;
  const neededHumanCount = incidents.filter(
    (i) => i.resolvedBy === "human" || i.decision === "approved" || i.decision === "rejected" || i.riskLevel === "high"
  ).length;

  const resolvedWithTimings = incidents.filter(
    (i) => i.resolvedAt && (i.detectedAt || i.createdAt)
  );
  let avgRecoveryText = "—";
  if (resolvedWithTimings.length > 0) {
    const totalDiffMs = resolvedWithTimings.reduce((acc, inc) => {
      const start = new Date(inc.detectedAt || inc.createdAt).getTime();
      const end = new Date(inc.resolvedAt!).getTime();
      return acc + Math.max(0, end - start);
    }, 0);
    const avgSec = (totalDiffMs / resolvedWithTimings.length / 1000).toFixed(1);
    avgRecoveryText = `${avgSec}s`;
  }

  return (
    <header className="flex flex-col shrink-0 select-none z-30">
      {/* 1. Apple macOS Unified Toolbar (h-[52px]) */}
      <div className="h-[52px] border-b border-[var(--border)] apple-glass px-4.5 flex items-center justify-between transition-colors">
        {/* Left: Brand, Live indicator capsule & System scope */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Apple App Icon Squircle */}
            <div className="w-7 h-7 rounded-[9px] bg-gradient-to-tr from-[#0071E3] via-[#4387F6] to-[#5856D6] flex items-center justify-center text-white shadow-sm shrink-0">
              <ShieldCheckIcon className="w-4 h-4" />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-[15px] text-[var(--text-primary)] tracking-tight">
                AutoMedic
              </span>
              <span className="hidden sm:inline-flex text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[var(--text-secondary)] border border-black/[0.04] dark:border-white/[0.06]">
                Self-Healing AI
              </span>
            </div>

            {/* Apple Style Live Indicator Capsule */}
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                isOnline
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              }`}
              title={isOnline ? "Connected to Firestore Realtime" : "Disconnected from Firestore"}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`}
              />
              <span>{isOnline ? "Live" : "Offline"}</span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-[var(--border)] hidden lg:block" />

          {/* Center-left: Apple Bento Metric Capsules */}
          <div className="hidden lg:flex items-center gap-1.5 text-[12px] truncate">
            {/* Metric 1 */}
            <div className="px-2.5 py-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.03] dark:border-white/[0.05] flex items-center gap-1.5">
              <span className="text-[var(--text-muted)]">Runs:</span>
              <span className="font-semibold text-[var(--text-primary)]">{totalRuns}</span>
            </div>

            {/* Metric 2 */}
            <div className="px-2.5 py-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.03] dark:border-white/[0.05] flex items-center gap-1.5">
              <span className="text-[var(--text-muted)]">Healed:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{autoHealedCount}</span>
            </div>

            {/* Metric 3 */}
            <div className="px-2.5 py-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.03] dark:border-white/[0.05] flex items-center gap-1.5">
              <span className="text-[var(--text-muted)]">Needs Review:</span>
              <span className={`font-semibold ${neededHumanCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-primary)]"}`}>
                {neededHumanCount}
              </span>
            </div>

            {/* Metric 4 */}
            <div className="px-2.5 py-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.03] dark:border-white/[0.05] flex items-center gap-1.5">
              <span className="text-[var(--text-muted)]">Avg MTTR:</span>
              <span className="font-semibold text-[var(--text-primary)] font-mono text-[11px]">{avgRecoveryText}</span>
            </div>

            {/* Apple Segmented Scope Switcher */}
            {onToggleAllTime && (
              <button
                onClick={onToggleAllTime}
                className="ml-1 text-[11px] font-medium px-2 py-0.5 rounded-full text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all cursor-pointer"
                title="Toggle session scope vs all time"
              >
                {showAllTime ? "Scope: All Time" : "Scope: This Session"}
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Submit a Lead Button (Apple System Blue CTA) */}
          <button
            id="submit-lead-header-btn"
            onClick={onOpenSubmitLead}
            className="h-8 px-4 rounded-full bg-gradient-to-b from-[#0077ED] to-[#0066CC] hover:from-[#0082FF] hover:to-[#0070E0] text-white text-[12.5px] font-medium shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Submit a lead</span>
          </button>
        </div>
      </div>

      {/* 2. Apple Connected Systems Sub-bar (h-8.5) */}
      <div className="h-[34px] border-b border-[var(--border)] bg-[var(--surface-subtle)]/90 backdrop-blur-md px-4.5 flex items-center justify-between text-[11.5px] text-[var(--text-muted)]">
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none">
          <span className="font-medium text-[var(--text-secondary)] shrink-0 flex items-center gap-1">
            <span>Pipelines:</span>
          </span>

          {/* Lead Webhook */}
          <div className="flex items-center gap-1.5 shrink-0" title="Incoming Lead Webhook">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[var(--text-primary)] font-medium">Lead Webhook</span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">Live</span>
          </div>

          <span className="text-[var(--border)]">·</span>

          {/* Enrichment */}
          <div className="flex items-center gap-1.5 shrink-0" title="Company Enrichment API">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[var(--text-primary)] font-medium">Enrichment</span>
            <span className="text-[10px] text-[var(--text-muted)]">Hunter.io</span>
          </div>

          <span className="text-[var(--border)]">·</span>

          {/* CRM */}
          <div className="flex items-center gap-1.5 shrink-0" title="CRM Contact Store">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[var(--text-primary)] font-medium">CRM</span>
            <span className="text-[10px] text-[var(--text-muted)]">HubSpot</span>
          </div>

          <span className="text-[var(--border)]">·</span>

          {/* Email */}
          <div className="flex items-center gap-1.5 shrink-0" title="Transactional Email Delivery">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[var(--text-primary)] font-medium">Email</span>
            <span className="text-[10px] text-[var(--text-muted)]">Resend</span>
          </div>
        </div>

        {/* Right side webhook endpoint pill */}
        <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] shrink-0 bg-black/[0.03] dark:bg-white/[0.05] px-2 py-0.5 rounded-md border border-black/[0.04] dark:border-white/[0.06]">
          <span className="text-[var(--accent)] font-semibold">POST</span>
          <span className="text-[var(--text-secondary)]">/api/webhooks/lead</span>
        </div>
      </div>
    </header>
  );
}
