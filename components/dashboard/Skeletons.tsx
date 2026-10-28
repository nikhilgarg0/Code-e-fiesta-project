// components/dashboard/Skeletons.tsx
"use client";

import React from "react";

export function RunsListSkeleton() {
  return (
    <div className="w-[320px] border-r border-[var(--border)] bg-[var(--surface-subtle)] p-3 space-y-2.5 animate-pulse select-none">
      <div className="h-4 bg-black/[0.06] dark:bg-white/[0.08] rounded-full w-1/3 mb-4"></div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="p-3 bg-black/[0.02] dark:bg-white/[0.03] rounded-2xl border border-[var(--border)] space-y-2">
          <div className="flex justify-between items-center">
            <div className="h-3.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full w-24"></div>
            <div className="h-3.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-full w-16"></div>
          </div>
          <div className="h-3 bg-black/[0.04] dark:bg-white/[0.06] rounded-full w-36"></div>
        </div>
      ))}
    </div>
  );
}

export function RunTimelineSkeleton() {
  return (
    <div className="flex-1 p-5 space-y-4 animate-pulse bg-[var(--bg)] select-none">
      <div className="flex justify-between items-center pb-4 border-b border-[var(--border)]">
        <div className="h-5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full w-48"></div>
        <div className="h-5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full w-20"></div>
      </div>
      <div className="space-y-4 pt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-2xl bg-black/[0.06] dark:bg-white/[0.08] shrink-0"></div>
            <div className="flex-1 p-3.5 bg-black/[0.02] dark:bg-white/[0.03] rounded-2xl border border-[var(--border)] space-y-2">
              <div className="h-4 bg-black/[0.06] dark:bg-white/[0.08] rounded-full w-32"></div>
              <div className="h-3 bg-black/[0.04] dark:bg-white/[0.06] rounded-full w-3/4"></div>
              <div className="h-12 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IncidentPanelSkeleton() {
  return (
    <div className="w-[360px] border-l border-[var(--border)] apple-glass p-4 space-y-4 animate-pulse select-none">
      <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
        <div className="h-4 bg-black/[0.06] dark:bg-white/[0.08] rounded-full w-32"></div>
        <div className="h-4 bg-black/[0.04] dark:bg-white/[0.06] rounded-full w-16"></div>
      </div>
      <div className="p-3.5 bg-black/[0.02] dark:bg-white/[0.03] rounded-2xl border border-[var(--border)] space-y-2.5">
        <div className="h-4 bg-black/[0.06] dark:bg-white/[0.08] rounded-full w-28"></div>
        <div className="h-3 bg-black/[0.04] dark:bg-white/[0.06] rounded-full w-full"></div>
        <div className="h-3 bg-black/[0.04] dark:bg-white/[0.06] rounded-full w-5/6"></div>
      </div>
      <div className="p-3.5 bg-black/[0.02] dark:bg-white/[0.03] rounded-2xl border border-[var(--border)] space-y-2.5">
        <div className="h-4 bg-black/[0.06] dark:bg-white/[0.08] rounded-full w-24"></div>
        <div className="h-16 bg-black/[0.03] dark:bg-white/[0.05] rounded-xl"></div>
      </div>
      <div className="pt-2 flex gap-2">
        <div className="h-8.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full flex-1"></div>
        <div className="h-8.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-full flex-1"></div>
      </div>
    </div>
  );
}
