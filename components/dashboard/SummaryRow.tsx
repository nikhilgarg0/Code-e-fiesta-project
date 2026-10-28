// components/dashboard/SummaryRow.tsx
"use client";

import React from "react";
import { WorkflowRun, Incident } from "@/lib/types";

interface SummaryRowProps {
  runs: WorkflowRun[];
  incidents: Incident[];
  showAllTime: boolean;
  onToggleAllTime: () => void;
}

export function SummaryRow({
  runs,
  incidents,
  showAllTime,
  onToggleAllTime,
}: SummaryRowProps) {
  const totalRuns = runs.length;

  const autoHealedCount = incidents.filter(
    (i) => i.resolvedBy === "auto" || (i.outcome === "recovered" && i.decision === "auto_applied")
  ).length;

  const neededHumanCount = incidents.filter(
    (i) => i.resolvedBy === "human" || i.decision === "approved" || i.decision === "rejected" || i.riskLevel === "high"
  ).length;

  // Mean Time to Recovery (MTTR)
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
    <div className="rounded-[20px] border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.45)] px-4 py-2.5 shrink-0 select-none transition-colors duration-150">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 4 Apple Bento Stat Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1 max-w-4xl">
          {/* Tile 1: Runs */}
          <div className="bg-black/[0.025] dark:bg-white/[0.04] border border-black/[0.03] dark:border-white/[0.05] rounded-xl px-3.5 py-2 transition-all">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Runs
            </div>
            <div className="text-xl font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5 tracking-tight">
              {totalRuns}
            </div>
          </div>

          {/* Tile 2: Healed automatically */}
          <div className="bg-black/[0.025] dark:bg-white/[0.04] border border-black/[0.03] dark:border-white/[0.05] rounded-xl px-3.5 py-2 transition-all">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
              <span>Healed automatically</span>
            </div>
            <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 tracking-tight">
              {autoHealedCount}
            </div>
          </div>

          {/* Tile 3: Needed a human */}
          <div className="bg-black/[0.025] dark:bg-white/[0.04] border border-black/[0.03] dark:border-white/[0.05] rounded-xl px-3.5 py-2 transition-all">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
              <span>Needed a human</span>
            </div>
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-400 mt-0.5 tracking-tight">
              {neededHumanCount}
            </div>
          </div>

          {/* Tile 4: Avg. recovery time */}
          <div className="bg-black/[0.025] dark:bg-white/[0.04] border border-black/[0.03] dark:border-white/[0.05] rounded-xl px-3.5 py-2 transition-all">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Avg. recovery time
            </div>
            <div className="text-xl font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5 tracking-tight">
              {avgRecoveryText}
            </div>
          </div>
        </div>

        {/* Scope Toggle: This session vs All time */}
        <div className="flex items-center gap-1.5 self-center">
          <button
            id="scope-toggle-btn"
            onClick={onToggleAllTime}
            className="text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium px-3 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.09] border border-black/[0.04] dark:border-white/[0.06] transition-all flex items-center gap-2 active:scale-95"
          >
            <span
              className={`w-2 h-2 rounded-full border transition-colors ${
                showAllTime
                  ? "bg-indigo-600 border-indigo-600 shadow-[0_0_6px_rgba(99,102,241,0.5)]"
                  : "bg-transparent border-zinc-400 dark:border-zinc-500"
              }`}
            />
            <span>{showAllTime ? "Showing all time" : "This session only"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
