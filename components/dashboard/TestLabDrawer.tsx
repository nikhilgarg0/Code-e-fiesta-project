// components/dashboard/TestLabDrawer.tsx
"use client";

import React, { useState } from "react";
import { ChaosConfig, ChaosMode, DemoState } from "@/lib/types";
import { XIcon, SparklesIcon, RefreshCwIcon, PlayIcon } from "./Icons";
import { getChaosModeInfo } from "@/lib/labels";

interface TestLabDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chaos: ChaosConfig | null;
  demo?: DemoState | null;
  onSetChaosMode: (mode: ChaosMode) => Promise<void>;
  onStartDemo: () => Promise<void>;
  onSkipDemo?: () => void;
  onStopDemo?: () => void;
  onReset: () => Promise<void>;
}

const FAULT_SCENARIOS: ChaosMode[] = [
  "none",
  "schema_drift",
  "transient_500",
  "bad_type",
  "primary_down",
  "bad_fix_trap",
];

export function TestLabDrawer({
  isOpen,
  onClose,
  chaos,
  demo,
  onSetChaosMode,
  onStartDemo,
  onSkipDemo,
  onStopDemo,
  onReset,
}: TestLabDrawerProps) {
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  if (!isOpen) return null;

  const activeMode: ChaosMode = (chaos?.mode as ChaosMode) || "none";
  const isDemoActive = demo && demo.status !== "idle";

  const handleSelectMode = async (mode: ChaosMode) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await onSetChaosMode(mode);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunDemo = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await onStartDemo();
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmReset = async () => {
    setIsBusy(true);
    try {
      await onReset();
      setIsResetConfirming(false);
    } finally {
      setIsBusy(false);
    }
  };

  // State text for counters
  const getScenarioStateText = (mode: ChaosMode) => {
    if (mode !== activeMode) return null;
    const counters = chaos?.counters || {};

    if (mode === "transient_500") {
      const count = counters["transient_500"] || 0;
      const left = Math.max(0, 2 - count);
      return left > 0 ? `Active: fails 2 calls, then recovers (${left} left)` : "Recovered: now responding normally";
    }
    if (mode === "none") {
      return "Active: healthy normal operation";
    }
    return "Active: next lead will trigger this scenario";
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Apple Frosted Backdrop */}
      <div
        className="absolute inset-0 bg-black/35 dark:bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md apple-glass border-l border-[var(--border)] shadow-2xl flex flex-col h-full rounded-l-3xl overflow-hidden animate-fadeIn">
          {/* Drawer Header (h-14) */}
          <div className="h-14 px-5 border-b border-[var(--border)] flex items-center justify-between gap-3 shrink-0">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight">
                Test Lab & Chaos Engine
              </h2>
              <p className="text-[11.5px] text-[var(--text-muted)] font-medium">
                Simulate production failures and self-healing
              </p>
            </div>

            <button
              id="close-test-lab-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all cursor-pointer active:scale-95"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* 1. Apple Intelligence / Guided Demo Card */}
            <div className="p-4 rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-tr from-[var(--accent)]/10 via-purple-500/10 to-transparent space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center">
                    <SparklesIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    Interactive Guided Demo
                  </span>
                </div>
                {isDemoActive && (
                  <span className="text-[11px] font-mono text-[var(--accent)] font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/15 animate-pulse">
                    Step {demo?.step} of {demo?.totalSteps}
                  </span>
                )}
              </div>

              {isDemoActive ? (
                <div className="space-y-2.5 pt-1">
                  <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed font-medium">
                    {demo?.label || demo?.actionPrompt || "Running scenario..."}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={onSkipDemo}
                      className="px-3.5 py-1.5 text-[12px] font-semibold rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      Skip step
                    </button>
                    <button
                      onClick={onStopDemo}
                      className="px-3.5 py-1.5 text-[12px] font-semibold rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all cursor-pointer active:scale-95"
                    >
                      Stop demo
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  id="run-guided-demo-btn"
                  onClick={handleRunDemo}
                  disabled={isBusy}
                  className="w-full h-9 rounded-full bg-gradient-to-b from-[#0077ED] to-[#0066CC] hover:from-[#0082FF] hover:to-[#0070E0] text-white text-[12.5px] font-semibold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
                >
                  <PlayIcon className="w-3.5 h-3.5" />
                  <span>Start Guided Walkthrough</span>
                </button>
              )}
            </div>

            {/* 2. Apple Settings Fault Scenarios List */}
            <div className="space-y-2.5">
              <div className="text-[11.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Fault Injection Scenarios
              </div>

              <div className="space-y-2">
                {FAULT_SCENARIOS.map((mode) => {
                  const isSelected = mode === activeMode;
                  const info = getChaosModeInfo(mode);
                  const stateText = getScenarioStateText(mode);

                  return (
                    <div
                      key={mode}
                      onClick={() => handleSelectMode(mode)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#0071E3] dark:border-[#0A84FF] bg-[#0071E3]/10 dark:bg-[#0A84FF]/15 ring-1 ring-[#0071E3]/30 shadow-xs"
                          : "border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-[#0071E3] dark:border-[#0A84FF] bg-[#0071E3] dark:bg-[#0A84FF]"
                              : "border-[var(--border-strong)] bg-transparent"
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                            {info.name}
                          </div>
                          <p className="text-[11.5px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                            {info.description}
                          </p>

                          {stateText && (
                            <div className="mt-2 text-[11px] font-semibold text-[var(--accent)] flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent)]/10 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                              <span>{stateText}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Drawer Footer: Apple System Red Destructive Action */}
          <div className="p-4.5 border-t border-[var(--border)] apple-glass shrink-0">
            {isResetConfirming ? (
              <div className="space-y-2.5">
                <p className="text-[12.5px] text-[var(--text-secondary)] font-medium">
                  Clear session runs and reset all scenarios?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleConfirmReset}
                    disabled={isBusy}
                    className="flex-1 h-9 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    {isBusy ? "Resetting..." : "Yes, purge everything"}
                  </button>
                  <button
                    onClick={() => setIsResetConfirming(false)}
                    className="h-9 px-4 rounded-full border border-[var(--border)] text-[var(--text-secondary)] text-[12px] font-medium hover:bg-black/[0.04] transition-all cursor-pointer active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                id="reset-everything-btn"
                onClick={() => setIsResetConfirming(true)}
                className="w-full h-9 rounded-full border border-[var(--border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[var(--text-muted)] hover:text-rose-600 dark:hover:text-rose-400 text-[12px] font-semibold transition-all cursor-pointer active:scale-95"
              >
                Reset session and purge data
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
