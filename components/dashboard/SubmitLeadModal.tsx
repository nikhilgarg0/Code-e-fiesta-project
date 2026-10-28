"use client";

import React, { useState, useEffect } from "react";
import { XIcon, SparklesIcon } from "./Icons";

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
    >
      <div
        className="w-full max-w-md rounded-[8px] bg-[var(--surface)] border border-[var(--border)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div>
            <h2
              id="modal-title"
              className="text-[14px] font-semibold text-[var(--text-primary)]"
            >
              Submit test lead
            </h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              Dispatches payload through the lead_to_crm workflow
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-6 h-6 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center justify-center transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Preset suggestions */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1.5">
            <SparklesIcon className="w-3 h-3 text-[var(--accent)]" />
            <span>Presets:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="px-2 py-0.5 text-[11px] rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
              >
                {p.name} <span className="text-[var(--text-muted)]">({p.company})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label
              htmlFor="lead-name"
              className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1"
            >
              Full name
            </label>
            <input
              id="lead-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Devon Vance"
              className="w-full px-2.5 py-1.5 text-[13px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="lead-email"
              className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1"
            >
              Work email
            </label>
            <input
              id="lead-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. devon@vance-biotech.com"
              className="w-full px-2.5 py-1.5 text-[13px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] font-mono text-[12px]"
            />
          </div>

          <div>
            <label
              htmlFor="lead-company"
              className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1"
            >
              Company name
            </label>
            <input
              id="lead-company"
              type="text"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Vance Biotech"
              className="w-full px-2.5 py-1.5 text-[13px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-7 px-3 text-[12px] font-medium rounded-[6px] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-7 px-3 text-[12px] font-medium rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? "Starting..." : "Submit lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
