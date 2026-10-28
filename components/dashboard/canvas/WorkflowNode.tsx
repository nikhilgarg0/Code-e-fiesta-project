// components/dashboard/canvas/WorkflowNode.tsx
"use client";

import React from "react";
import { CanvasNodeData, CanvasNodeStatus } from "./canvasUtils";
import {
  CheckCircleIcon,
  XCircleIcon,
  RefreshCwIcon,
  WrenchIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ServerIcon,
} from "../Icons";

interface WorkflowNodeProps {
  node: CanvasNodeData;
  isSelected: boolean;
  onClick: () => void;
}

export function WorkflowNode({ node, isSelected, onClick }: WorkflowNodeProps) {
  // Apple App Icon style squircle service icons (w-8 h-8 rounded-xl)
  const renderServiceIcon = () => {
    if (node.id === "node_trigger") {
      return (
        <div className="w-8 h-8 rounded-xl bg-zinc-500/10 dark:bg-zinc-400/10 border border-zinc-500/15 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 shadow-xs">
          <ServerIcon className="w-4 h-4" />
        </div>
      );
    }
    if (node.stepName === "validate_lead") {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
          <ShieldCheckIcon className="w-4 h-4" />
        </div>
      );
    }
    if (node.stepName === "enrich_company") {
      return (
        <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-xs">
          <ServerIcon className="w-4 h-4" />
        </div>
      );
    }
    if (node.stepName === "save_to_crm") {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
          <ServerIcon className="w-4 h-4" />
        </div>
      );
    }
    if (node.stepName === "send_followup") {
      return (
        <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-xs">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
      );
    }
    if (node.type === "healing") {
      return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-purple-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
          <SparklesIcon className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-zinc-500/10 flex items-center justify-center shrink-0">
        <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
      </div>
    );
  };

  // Right Edge Status Indicator
  const renderRightStatus = (status: CanvasNodeStatus) => {
    if (node.isGhost) return null;

    switch (status) {
      case "success":
        return <CheckCircleIcon className="w-4.5 h-4.5 text-emerald-500 shrink-0" />;
      case "healed":
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 shrink-0">
            <WrenchIcon className="w-3 h-3 text-emerald-500" />
            <span>Healed</span>
          </span>
        );
      case "failed":
        return <XCircleIcon className="w-4.5 h-4.5 text-rose-500 shrink-0" />;
      case "waiting_approval":
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20 shrink-0 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Review</span>
          </span>
        );
      case "healing":
      case "running":
        return <RefreshCwIcon className="w-4 h-4 text-[#0071E3] dark:text-[#0A84FF] animate-spin shrink-0" />;
      default:
        return null;
    }
  };

  // State-specific border & background styles
  const getNodeClasses = () => {
    if (node.isGhost) {
      return "bg-[var(--surface)]/70 border border-dashed border-[var(--border)] opacity-40 cursor-default";
    }

    const isHealingLayer = node.type === "healing";
    let bgClass = isHealingLayer
      ? "bg-indigo-500/[0.04] dark:bg-indigo-950/30"
      : "bg-white/95 dark:bg-[#1c1c1e]/95";

    let borderClass = "border border-black/[0.08] dark:border-white/[0.1] shadow-xs";

    if (node.status === "failed") {
      borderClass = "border-rose-500 ring-2 ring-rose-500/20 shadow-md";
    } else if (node.status === "waiting_approval") {
      borderClass = "border-amber-500 ring-2 ring-amber-500/20 shadow-md";
    } else if (node.status === "healed") {
      borderClass = "border-emerald-500 ring-1 ring-emerald-500/20 shadow-xs";
    } else if (node.status === "running" || node.status === "healing") {
      borderClass = "border-[#0071E3] dark:border-[#0A84FF] ring-2 ring-[#0071E3]/20 shadow-md";
    }

    if (isSelected) {
      borderClass = "ring-2 ring-[#0071E3] dark:ring-[#0A84FF] shadow-lg border-transparent";
    }

    return `${bgClass} ${borderClass} hover:shadow-md cursor-pointer`;
  };

  return (
    <div
      id={`node-card-${node.id}`}
      data-node="true"
      role="button"
      tabIndex={node.isGhost ? -1 : 0}
      aria-selected={isSelected}
      onClick={node.isGhost ? undefined : onClick}
      onKeyDown={(e) => {
        if (!node.isGhost && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
      className={`rounded-2xl px-3 py-1.5 transition-all select-none flex items-center justify-between gap-2.5 backdrop-blur-md active:scale-[0.99] ${getNodeClasses()}`}
    >
      {/* Left: Apple Squircle Service Icon */}
      {renderServiceIcon()}

      {/* Middle: Title & Subtitle */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight truncate">
          {node.title}
        </span>
        <div className="text-[11.5px] text-[var(--text-secondary)] leading-tight truncate mt-0.5 flex items-center gap-1 font-medium">
          <span className="truncate">{node.subtitle}</span>
          {node.mode && (
            <span className="text-[10px] text-[var(--text-muted)] shrink-0 font-mono">
              · {node.mode === "real" ? "Live" : "Mock"}
            </span>
          )}
        </div>
      </div>

      {/* Right Edge: Clean status indicator */}
      <div className="shrink-0 flex items-center justify-center">
        {renderRightStatus(node.status)}
      </div>
    </div>
  );
}
