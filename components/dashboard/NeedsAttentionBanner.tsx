// components/dashboard/NeedsAttentionBanner.tsx
"use client";

import React from "react";
import { WorkflowRun, Incident } from "@/lib/types";
import { AlertTriangleIcon } from "./Icons";
import { getRunStory } from "@/lib/labels";

interface NeedsAttentionBannerProps {
  awaitingRuns: WorkflowRun[];
  incidents: Incident[];
  onSelectRun: (runId: string) => void;
}

export function NeedsAttentionBanner({
  awaitingRuns,
  incidents,
  onSelectRun,
}: NeedsAttentionBannerProps) {
  if (awaitingRuns.length === 0) return null;

  const targetRun = awaitingRuns[0];
  const targetIncident = incidents.find((i) => i.runId === targetRun.id);
  const count = awaitingRuns.length;

  const leadName = (targetRun.inputPayload?.name as string) || "Lead";
  const company = (targetRun.inputPayload?.company as string) || "";
  const story = getRunStory(targetRun, targetIncident);

  return (
    <div
      id="needs-attention-banner"
      className="mx-4 my-2 px-4 py-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 backdrop-blur-xl flex items-center justify-between gap-3 text-[12.5px] shadow-sm select-none transition-all"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <AlertTriangleIcon className="w-3.5 h-3.5 animate-pulse" />
        </div>
        <div className="truncate">
          <span className="font-semibold text-amber-900 dark:text-amber-200 mr-2">
            {count === 1 ? "1 execution paused for review" : `${count} executions paused for review`}
          </span>
          <span className="text-amber-800/90 dark:text-amber-300/90">
            {leadName}{company ? ` (${company})` : ""}: {story}
          </span>
        </div>
      </div>

      <button
        id="review-attention-btn"
        onClick={() => onSelectRun(targetRun.id)}
        className="h-7 px-3.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-medium text-[11.5px] shadow-sm transition-all shrink-0 active:scale-95 cursor-pointer flex items-center gap-1"
      >
        <span>Review Now</span>
        <span>→</span>
      </button>
    </div>
  );
}
