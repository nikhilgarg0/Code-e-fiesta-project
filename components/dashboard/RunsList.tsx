// components/dashboard/RunsList.tsx
"use client";

import React, { useState, useMemo } from "react";
import { WorkflowRun, Incident } from "@/lib/types";
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  RefreshCwIcon,
} from "./Icons";
import { getRunStory, formatRelativeTime } from "@/lib/labels";

interface RunsListProps {
  runs: WorkflowRun[];
  incidents: Incident[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  loading?: boolean;
}

type FilterType = "all" | "needs_attention" | "healed" | "healthy";

export function RunsList({
  runs,
  incidents,
  selectedRunId,
  onSelectRun,
  loading,
}: RunsListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // Map incident lookup for quick O(1) story derivation
  const incidentMap = useMemo(() => {
    const map = new Map<string, Incident>();
    for (const inc of incidents) {
      if (!map.has(inc.runId)) {
        map.set(inc.runId, inc);
      }
    }
    return map;
  }, [incidents]);

  // Counts for filter tabs
  const counts = useMemo(() => {
    return {
      all: runs.length,
      needs_attention: runs.filter((r) => r.status === "awaiting_approval").length,
      healed: runs.filter((r) => r.status === "healed").length,
      healthy: runs.filter((r) => r.status === "success").length,
    };
  }, [runs]);

  // Filtered runs
  const filteredRuns = useMemo(() => {
    switch (activeFilter) {
      case "needs_attention":
        return runs.filter((r) => r.status === "awaiting_approval");
      case "healed":
        return runs.filter((r) => r.status === "healed");
      case "healthy":
        return runs.filter((r) => r.status === "success");
      default:
        return runs;
    }
  }, [runs, activeFilter]);

  // Render Apple-style status avatar
  const renderStatusAvatar = (status: string) => {
    switch (status) {
      case "success":
      case "healed":
        return (
          <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircleIcon className="w-4 h-4" />
          </div>
        );
      case "awaiting_approval":
        return (
          <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 animate-pulse">
            <AlertTriangleIcon className="w-4 h-4" />
          </div>
        );
      case "healing":
      case "running":
        return (
          <div className="w-7 h-7 rounded-xl bg-[#0071E3]/15 text-[#0071E3] dark:text-[#0A84FF] flex items-center justify-center shrink-0">
            <RefreshCwIcon className="w-4 h-4 animate-spin" />
          </div>
        );
      case "failed":
        return (
          <div className="w-7 h-7 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <XCircleIcon className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-xl bg-zinc-400/15 text-zinc-500 flex items-center justify-center shrink-0">
            <span className="w-2 h-2 rounded-full bg-zinc-400" />
          </div>
        );
    }
  };

  return (
    <aside className="w-[320px] shrink-0 border-r border-[var(--border)] bg-[var(--surface-subtle)] flex flex-col h-full overflow-hidden select-none">
      {/* 1. Apple macOS Segmented Filter Control */}
      <div className="p-2.5 shrink-0 border-b border-[var(--border)]">
        <div className="bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-2xl flex items-center gap-1">
          {/* Tab 1: All */}
          <button
            onClick={() => setActiveFilter("all")}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[11.5px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeFilter === "all"
                ? "bg-white dark:bg-[#2c2c2e] text-[var(--text-primary)] shadow-sm font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span>All</span>
            <span className="text-[10px] opacity-70">({counts.all})</span>
          </button>

          {/* Tab 2: Attention */}
          <button
            onClick={() => setActiveFilter("needs_attention")}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[11.5px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeFilter === "needs_attention"
                ? "bg-white dark:bg-[#2c2c2e] text-amber-600 dark:text-amber-400 shadow-sm font-semibold"
                : counts.needs_attention > 0
                ? "text-amber-600 dark:text-amber-400 font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span>Review</span>
            {counts.needs_attention > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                {counts.needs_attention}
              </span>
            )}
          </button>

          {/* Tab 3: Healed */}
          <button
            onClick={() => setActiveFilter("healed")}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[11.5px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeFilter === "healed"
                ? "bg-white dark:bg-[#2c2c2e] text-[var(--text-primary)] shadow-sm font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span>Healed</span>
            <span className="text-[10px] opacity-70">({counts.healed})</span>
          </button>

          {/* Tab 4: Healthy */}
          <button
            onClick={() => setActiveFilter("healthy")}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[11.5px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeFilter === "healthy"
                ? "bg-white dark:bg-[#2c2c2e] text-[var(--text-primary)] shadow-sm font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span>Healthy</span>
            <span className="text-[10px] opacity-70">({counts.healthy})</span>
          </button>
        </div>
      </div>

      {/* 2. Apple Mail/Reminders Inset List Items */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {loading && runs.length === 0 ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-[var(--border)] flex items-center gap-3 animate-pulse">
                <div className="w-7 h-7 rounded-xl bg-black/[0.05] dark:bg-white/[0.05] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-black/[0.05] dark:bg-white/[0.05] rounded-full w-2/3" />
                  <div className="h-2.5 bg-black/[0.03] dark:bg-white/[0.03] rounded-full w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-[var(--text-muted)] mb-3">
              <CheckCircleIcon className="w-5 h-5 opacity-40" />
            </div>
            <p className="text-[12.5px] text-[var(--text-muted)] font-medium">
              {activeFilter === "all"
                ? "No executions yet. Submit a lead to start."
                : `No runs in "${activeFilter.replace("_", " ")}".`}
            </p>
          </div>
        ) : (
          filteredRuns.map((run) => {
            const isSelected = run.id === selectedRunId;
            const inc = incidentMap.get(run.id);
            const leadName = (run.inputPayload?.name as string) || "Lead";
            const company = (run.inputPayload?.company as string) || "";
            const story = getRunStory(run, inc);
            const relativeTime = formatRelativeTime(run.startedAt);

            return (
              <div
                key={run.id}
                id={`run-item-${run.id}`}
                onClick={() => onSelectRun(run.id)}
                className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 relative ${
                  isSelected
                    ? "bg-[#0071E3]/10 dark:bg-[#0A84FF]/15 text-[var(--text-primary)] ring-1 ring-[#0071E3]/30 dark:ring-[#0A84FF]/40 shadow-xs"
                    : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[var(--text-primary)]"
                }`}
              >
                {/* Status Icon */}
                <div className="shrink-0">{renderStatusAvatar(run.status)}</div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                      {leadName}{company ? ` · ${company}` : ""}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] shrink-0 font-medium">
                      {relativeTime}
                    </span>
                  </div>

                  <p className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">
                    {story}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Apple Sidebar Footer: All Lead History */}
      <div className="h-9 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-3.5 flex items-center justify-between text-[11.5px] text-[var(--text-muted)] shrink-0 font-medium">
        <span>Lead History</span>
        <span className="font-semibold text-[var(--text-primary)]">{runs.length} recorded</span>
      </div>
    </aside>
  );
}
