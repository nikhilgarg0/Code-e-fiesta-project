"use client";

import React from "react";

export function RunsListSkeleton() {
  return (
    <div className="w-80 border-r border-zinc-800 bg-zinc-950/60 p-3 space-y-2.5 animate-pulse">
      <div className="h-4 bg-zinc-800/80 rounded w-1/3 mb-4"></div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/60 space-y-2">
          <div className="flex justify-between items-center">
            <div className="h-3.5 bg-zinc-800 rounded w-24"></div>
            <div className="h-3.5 bg-zinc-800 rounded w-16"></div>
          </div>
          <div className="h-3 bg-zinc-800/50 rounded w-36"></div>
        </div>
      ))}
    </div>
  );
}

export function RunTimelineSkeleton() {
  return (
    <div className="flex-1 p-5 space-y-4 animate-pulse bg-black/40">
      <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <div className="h-5 bg-zinc-800 rounded w-48"></div>
        <div className="h-5 bg-zinc-800 rounded w-20"></div>
      </div>
      <div className="space-y-4 pt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4 items-start">
            <div className="w-6 h-6 rounded-full bg-zinc-800 shrink-0"></div>
            <div className="flex-1 p-3.5 bg-zinc-900/40 rounded-lg border border-zinc-800/60 space-y-2">
              <div className="h-4 bg-zinc-800 rounded w-32"></div>
              <div className="h-3 bg-zinc-800/60 rounded w-3/4"></div>
              <div className="h-12 bg-zinc-900 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IncidentPanelSkeleton() {
  return (
    <div className="w-96 border-l border-zinc-800 bg-zinc-950/60 p-4 space-y-4 animate-pulse">
      <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
        <div className="h-4 bg-zinc-800 rounded w-32"></div>
        <div className="h-4 bg-zinc-800 rounded w-16"></div>
      </div>
      <div className="p-3.5 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-2.5">
        <div className="h-4 bg-zinc-800 rounded w-28"></div>
        <div className="h-3 bg-zinc-800/60 rounded w-full"></div>
        <div className="h-3 bg-zinc-800/60 rounded w-5/6"></div>
      </div>
      <div className="p-3.5 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-2.5">
        <div className="h-4 bg-zinc-800 rounded w-24"></div>
        <div className="h-16 bg-zinc-800/40 rounded"></div>
      </div>
      <div className="pt-2 flex gap-2">
        <div className="h-8 bg-zinc-800 rounded flex-1"></div>
        <div className="h-8 bg-zinc-800 rounded flex-1"></div>
      </div>
    </div>
  );
}
