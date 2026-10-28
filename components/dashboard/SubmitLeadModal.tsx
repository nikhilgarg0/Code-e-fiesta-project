// components/dashboard/SubmitLeadModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { XIcon, SparklesIcon, PlusIcon } from "./Icons";

interface SubmitLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunTriggered: (runId: string) => void;
  onErrorToast?: (error: string) => void;
}

const PRESETS = [
  {
    name: "Devon Vance",
    email: "devon@vance-biotech.com",
    company: "Vance Biotech",
  },
  {
    name: "Maya Lin",
    email: "maya@retool-demo.com",
    company: "Retool",
  },
  {
    name: "Carlos Ray",
    email: "carlos@figma-demo.io",
    company: "Figma",
  },
];

export function SubmitLeadModal({
  isOpen,
  onClose,
  onRunTriggered,
  onErrorToast,
}: SubmitLeadModalProps) {
  const [name, setName] = useState("Devon Vance");
  const [email, setEmail] = useState("devon@vance-biotech.com");
  const [company, setCompany] = useState("Vance Biotech");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Esc key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: (typeof PRESETS)[0]) => {
    setName(preset.name);
    setEmail(preset.email);
    setCompany(preset.company);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !company.trim()) {
      onErrorToast?.("Please fill out name, email, and company.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowName: "lead_to_crm",
          lead: {
            name: name.trim(),
            email: email.trim(),
            company: company.trim(),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start workflow run");
      }

      const data = await res.json();
      onRunTriggered(data.runId);
      onClose();
    } catch (err: unknown) {
      onErrorToast?.(
        err instanceof Error ? err.message : "Failed to submit lead"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl apple-glass border border-black/[0.08] dark:border-white/[0.1] shadow-2xl overflow-hidden p-6 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0071E3] to-[#5856D6] text-white flex items-center justify-center shadow-sm shrink-0">
              <PlusIcon className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="modal-title"
                className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight"
              >
                Submit Test Lead
              </h2>
              <p className="text-[12px] text-[var(--text-muted)] font-medium mt-0.5">
                Execute live enrichment, CRM, and email pipeline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all cursor-pointer active:scale-95"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Preset Suggestions */}
        <div className="pt-4 pb-2">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            <SparklesIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Quick Fill Presets:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="px-3 py-1 text-[11.5px] font-medium rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.05] text-[var(--text-secondary)] hover:bg-[#0071E3]/10 hover:text-[var(--accent)] hover:border-[#0071E3]/30 transition-all cursor-pointer active:scale-95"
              >
                {p.name} <span className="text-[var(--text-muted)]">({p.company})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="pt-2 space-y-3.5">
          <div>
            <label
              htmlFor="lead-name"
              className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1"
            >
              Full Name
            </label>
            <input
              id="lead-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Devon Vance"
              className="w-full px-3.5 py-2 text-[13.5px] rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.04] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3] transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="lead-email"
              className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1"
            >
              Work Email Address
            </label>
            <input
              id="lead-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. devon@vance-biotech.com"
              className="w-full px-3.5 py-2 text-[13.5px] rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.04] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3] transition-all font-mono text-[12.5px]"
            />
          </div>

          <div>
            <label
              htmlFor="lead-company"
              className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1"
            >
              Company Name
            </label>
            <input
              id="lead-company"
              type="text"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Vance Biotech"
              className="w-full px-3.5 py-2 text-[13.5px] rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.04] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3] transition-all"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-4 text-[12.5px] font-medium rounded-full text-[var(--text-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-5 text-[12.5px] font-semibold rounded-full bg-gradient-to-b from-[#0077ED] to-[#0066CC] hover:from-[#0082FF] hover:to-[#0070E0] text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <span>Starting Pipeline...</span>
              ) : (
                <>
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Start Pipeline</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
