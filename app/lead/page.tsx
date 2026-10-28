// app/lead/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "@/components/dashboard/Icons";

export default function LeadSubmissionPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    website: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittedRunId, setSubmittedRunId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const presets = [
    { name: "Guillermo Rauch", email: "guillermo@vercel.com", company: "Vercel", website: "https://vercel.com" },
    { name: "Karri Saarinen", email: "karri@linear.app", company: "Linear", website: "https://linear.app" },
    { name: "Patrick Collison", email: "patrick@stripe.com", company: "Stripe", website: "https://stripe.com" },
  ];

  const handlePreset = (preset: typeof presets[0]) => {
    setFormData(preset);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/webhooks/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          company: formData.company.trim(),
          website: formData.website.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit lead");
      }

      setSubmittedRunId(data.runId);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg)] text-[var(--text-primary)] flex flex-col justify-between font-sans antialiased select-none">
      {/* 1. Apple macOS Style Top Header */}
      <header className="border-b border-[var(--border)] apple-glass px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0071E3] via-[#4387F6] to-[#5856D6] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <ShieldCheckIcon className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="font-semibold text-[15px] tracking-tight text-[var(--text-primary)] flex items-center gap-2">
              AutoMedic
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[var(--accent)] border border-[#0071E3]/20">
                Live Intake
              </span>
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="px-4 py-1.5 rounded-full text-xs font-semibold bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-[var(--text-primary)] border border-black/[0.06] dark:border-white/[0.08] transition-all active:scale-95 flex items-center gap-1.5"
        >
          <span>← Back to Console</span>
        </Link>
      </header>

      {/* 2. Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {submittedRunId ? (
            /* Apple Success Receipt State */
            <div className="apple-glass border border-emerald-500/30 rounded-3xl p-8 shadow-2xl text-center animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-4 shadow-sm">
                <CheckCircleIcon className="w-7 h-7" />
              </div>

              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                Lead Ingested & Pipeline Dispatched
              </h2>

              <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
                Your lead was submitted to the webhook runtime. AutoMedic is now executing enrichment, CRM sync, and email dispatch with automated self-healing guardrails.
              </p>

              <div className="my-6 p-3.5 bg-black/[0.02] dark:bg-white/[0.04] border border-[var(--border)] rounded-2xl font-mono text-xs flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Execution Run ID:</span>
                <span className="font-bold text-[var(--accent)]">#{submittedRunId}</span>
              </div>

              <div className="flex flex-col gap-2.5">
                <Link
                  href={`/?runId=${submittedRunId}`}
                  className="w-full py-2.5 rounded-full text-xs font-semibold bg-gradient-to-b from-[#0077ED] to-[#0066CC] hover:from-[#0082FF] hover:to-[#0070E0] text-white shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <SparklesIcon className="w-4 h-4" />
                  <span>View Live Execution in Console →</span>
                </Link>

                <button
                  onClick={() => {
                    setSubmittedRunId(null);
                    setFormData({ name: "", email: "", company: "", website: "" });
                  }}
                  className="w-full py-2 rounded-full text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  Submit Another Lead
                </button>
              </div>
            </div>
          ) : (
            /* Apple Form State */
            <div className="apple-glass border border-black/[0.08] dark:border-white/[0.1] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="mb-6">
                <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                  <span>Submit Live Lead</span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    Webhook Trigger
                  </span>
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                  Trigger the real AutoMedic workflow across Hunter.io, HubSpot, and Resend with automated anomaly recovery.
                </p>
              </div>

              {/* Sample Presets */}
              <div className="mb-6">
                <div className="text-[11.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Quick Load Demo Presets:
                </div>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.company}
                      type="button"
                      onClick={() => handlePreset(p)}
                      className="px-3 py-1 text-xs font-medium rounded-full bg-black/[0.03] dark:bg-white/[0.05] hover:bg-[#0071E3]/10 hover:text-[var(--accent)] hover:border-[#0071E3]/30 border border-black/[0.06] dark:border-white/[0.08] transition-all cursor-pointer active:scale-95"
                    >
                      {p.company}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangleIcon className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Lead Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Elena Rostova"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. elena@biovance.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Biovance Technologies"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Company Website (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://biovance.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3] transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-3 py-2.5 rounded-full text-xs font-semibold bg-gradient-to-b from-[#0077ED] to-[#0066CC] hover:from-[#0082FF] hover:to-[#0070E0] text-white shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <SparklesIcon className="w-3.5 h-3.5" />
                  )}
                  <span>Dispatch Lead Through Pipeline</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--text-muted)] font-medium">
        AutoMedic Autonomous Self-Healing Pipeline · Ingests via POST /api/webhooks/lead
      </footer>
    </div>
  );
}
