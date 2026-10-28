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
    <div className="min-h-screen w-full bg-black text-zinc-100 flex flex-col justify-between selection:bg-purple-900 selection:text-white font-sans antialiased">
      {/* Top Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
            <ShieldCheckIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              AutoMedic
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300">
                Self-Healing Runtime
              </span>
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="px-3 py-1.5 rounded-lg text-xs font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {submittedRunId ? (
            /* Success State */
            <div className="bg-zinc-950 border border-emerald-500/40 rounded-2xl p-8 shadow-[0_0_35px_rgba(16,185,129,0.2)] text-center animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <CheckCircleIcon className="w-7 h-7" />
              </div>

              <h2 className="text-xl font-bold text-white tracking-tight">
                Lead Ingested & Workflow Dispatched!
              </h2>

              <p className="text-xs font-mono text-zinc-400 mt-2 leading-relaxed">
                Your lead was submitted to the live webhook. AutoMedic is now executing the enrichment, CRM registration, and email verification pipeline.
              </p>

              <div className="my-6 p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl font-mono text-xs flex items-center justify-between">
                <span className="text-zinc-500">Execution Run ID:</span>
                <span className="font-bold text-purple-400">#{submittedRunId}</span>
              </div>

              <div className="flex flex-col gap-2.5">
                <Link
                  href={`/?runId=${submittedRunId}`}
                  className="w-full py-2.5 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] border border-purple-400/40 transition-all flex items-center justify-center gap-2"
                >
                  <SparklesIcon className="w-4 h-4" />
                  View Live Run in AutoMedic Console →
                </Link>

                <button
                  onClick={() => {
                    setSubmittedRunId(null);
                    setFormData({ name: "", email: "", company: "", website: "" });
                  }}
                  className="w-full py-2 rounded-xl text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Submit Another Lead
                </button>
              </div>
            </div>
          ) : (
            /* Form State */
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="mb-6">
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Submit Live Lead</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    Webhook Trigger
                  </span>
                </h1>
                <p className="text-xs text-zinc-400 mt-1 font-mono">
                  Submit a lead to trigger the full AutoMedic pipeline over real services.
                </p>
              </div>

              {/* Sample Presets */}
              <div className="mb-6">
                <div className="text-[11px] font-mono uppercase text-zinc-500 font-semibold mb-2">
                  Quick Load Demo Presets:
                </div>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.company}
                      type="button"
                      onClick={() => handlePreset(p)}
                      className="px-2.5 py-1 text-xs font-mono rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
                    >
                      {p.company}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="mb-5 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-mono flex items-center gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Lead Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1.5 font-medium">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Elena Rostova"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-purple-500/60 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1.5 font-medium">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. elena@biovance.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-purple-500/60 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1.5 font-medium">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Biovance Technologies"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-purple-500/60 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1.5 font-medium">
                    Company Website (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://biovance.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-purple-500/60 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 py-2.5 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] border border-purple-400/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
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

      {/* Footer */}
      <footer className="border-t border-zinc-900 p-4 text-center text-xs font-mono text-zinc-600">
        AutoMedic Autonomous Self-Healing Pipeline • Dispatches via POST /api/webhooks/lead
      </footer>
    </div>
  );
}
