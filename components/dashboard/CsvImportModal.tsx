// components/dashboard/CsvImportModal.tsx
"use client";

import React, { useState } from "react";
import {
  XIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  SparklesIcon,
  UploadIcon,
} from "./Icons";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunTriggered?: (runId: string) => void;
  onErrorToast?: (err: string) => void;
}

interface ParsedLead {
  id: number;
  name: string;
  email: string;
  company: string;
  website?: string;
  status: "pending" | "processing" | "success" | "failed";
  runId?: string;
  error?: string;
}

const SAMPLE_MESSY_CSV = `name,email,company,website
Devon Vance,devon@vance-biotech.com,Vance Biotech,https://vance-biotech.com
Maya Lin,maya@lin-analytics.io,,https://lin-analytics.io
Carlos Ray,carlos-invalid-email,Ray Dynamics,https://raydynamics.com
Elena Rostova,elena@rostova.ai,Rostova AI,https://rostova.ai
Marcus Brody,marcus@brody.net,Brody Interactive,
Liam Gallagher,,Gallagher Media,https://gallagher.co
Zoe Chen,zoe@chen-robotics.org,Chen Robotics,https://chen-robotics.org
Aria Thorne,aria@thorne-technologies.com,Thorne Tech,https://thorne.com`;

export function CsvImportModal({
  isOpen,
  onClose,
  onRunTriggered,
}: CsvImportModalProps) {
  const [csvText, setCsvText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [leads, setLeads] = useState<ParsedLead[]>([]);
  const [processedCount, setProcessedCount] = useState(0);

  if (!isOpen) return null;

  const parseCsv = (text: string): ParsedLead[] => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) return [];

    // Header check
    const dataLines = lines.slice(1).slice(0, 50); // Up to 50 rows
    return dataLines.map((line, idx) => {
      const parts = line.split(",").map((p) => p.trim());
      return {
        id: idx + 1,
        name: parts[0] || "",
        email: parts[1] || "",
        company: parts[2] || "",
        website: parts[3] || undefined,
        status: "pending",
      };
    });
  };

  const handleLoadSample = () => {
    setCsvText(SAMPLE_MESSY_CSV);
    const parsed = parseCsv(SAMPLE_MESSY_CSV);
    setLeads(parsed);
    setProcessedCount(0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || "");
      setCsvText(content);
      const parsed = parseCsv(content);
      setLeads(parsed);
      setProcessedCount(0);
    };
    reader.readAsText(file);
  };

  const runWithConcurrency = async (items: ParsedLead[], limit = 2) => {
    setIsProcessing(true);
    let completed = 0;

    const queue = [...items];
    const executeNext = async (): Promise<void> => {
      const lead = queue.shift();
      if (!lead) return;

      // Update lead state to processing
      setLeads((prev) =>
        prev.map((item) => (item.id === lead.id ? { ...item, status: "processing" } : item))
      );

      try {
        const res = await fetch("/api/webhooks/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: lead.name,
            email: lead.email,
            company: lead.company,
            website: lead.website,
          }),
        });

        const data = await res.json();
        if (res.ok && data.runId) {
          setLeads((prev) =>
            prev.map((item) =>
              item.id === lead.id
                ? { ...item, status: "success", runId: data.runId }
                : item
            )
          );
          onRunTriggered?.(data.runId);
        } else {
          setLeads((prev) =>
            prev.map((item) =>
              item.id === lead.id
                ? { ...item, status: "failed", error: data.error || "Validation failed" }
                : item
            )
          );
        }
      } catch (err: unknown) {
        setLeads((prev) =>
          prev.map((item) =>
            item.id === lead.id
              ? { ...item, status: "failed", error: err instanceof Error ? err.message : "Network error" }
              : item
          )
        );
      } finally {
        completed++;
        setProcessedCount(completed);
        await executeNext();
      }
    };

    const workers = Array.from({ length: limit }, () => executeNext());
    await Promise.all(workers);
    setIsProcessing(false);
  };

  const handleStartImport = async () => {
    const parsed = leads.length > 0 ? leads : parseCsv(csvText);
    if (parsed.length === 0) return;
    setLeads(parsed);
    await runWithConcurrency(parsed, 2);
  };

  const successCount = leads.filter((l) => l.status === "success").length;
  const failedCount = leads.filter((l) => l.status === "failed").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none" onClick={onClose}>
      <div className="apple-glass border border-black/[0.08] dark:border-white/[0.1] rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="p-4.5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0071E3] to-[#5856D6] text-white flex items-center justify-center shadow-sm shrink-0">
              <UploadIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">
                Batch Lead Ingestion (CSV)
              </h3>
              <p className="text-[12px] text-[var(--text-muted)] font-medium mt-0.5">
                Ingest up to 50 leads with auto-validation and healing
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all cursor-pointer active:scale-95"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <button
              onClick={handleLoadSample}
              disabled={isProcessing}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#0071E3]/10 hover:bg-[#0071E3]/20 text-[var(--accent)] border border-[#0071E3]/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>Load Sample Messy Leads (8 rows)</span>
            </button>

            <label className="px-3.5 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] border border-black/[0.06] dark:border-white/[0.08] cursor-pointer transition-all flex items-center gap-1.5 active:scale-95">
              <UploadIcon className="w-3.5 h-3.5" />
              <span>Choose CSV file...</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden"
              />
            </label>
          </div>

          {/* Text Area */}
          <div>
            <textarea
              rows={4}
              placeholder="name,email,company,website&#10;Elena Rostova,elena@biovance.com,Biovance,https://biovance.com"
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setLeads(parseCsv(e.target.value));
              }}
              disabled={isProcessing}
              className="w-full bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] rounded-2xl p-3.5 text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
            />
          </div>

          {/* Parsed Leads Table Preview */}
          {leads.length > 0 && (
            <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-2xl overflow-hidden bg-black/[0.02] dark:bg-white/[0.03]">
              <div className="px-3.5 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] border-b border-[var(--border)] text-[11.5px] font-semibold text-[var(--text-muted)] flex items-center justify-between">
                <span>Leads Queue ({leads.length} rows)</span>
                <span>
                  Completed: {processedCount} / {leads.length}
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border-subtle)] text-xs">
                {leads.map((l) => (
                  <div key={l.id} className="p-3 flex items-center justify-between gap-3 text-[var(--text-primary)]">
                    <div className="truncate flex-1">
                      <span className="font-semibold">{l.name || "(missing name)"}</span>
                      <span className="text-[var(--text-muted)] ml-2">({l.company || "no company"})</span>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono truncate">{l.email || "no email"}</div>
                    </div>

                    <div className="text-[11.5px] shrink-0">
                      {l.status === "pending" && (
                        <span className="text-[var(--text-muted)] font-medium">pending</span>
                      )}
                      {l.status === "processing" && (
                        <span className="text-[#0071E3] flex items-center gap-1 font-semibold">
                          <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" /> running
                        </span>
                      )}
                      {l.status === "success" && (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircleIcon className="w-3.5 h-3.5" /> #{l.runId?.slice(0, 6)}
                        </span>
                      )}
                      {l.status === "failed" && (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold" title={l.error}>
                          <AlertTriangleIcon className="w-3.5 h-3.5" /> failed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Summary if Processing / Done */}
          {processedCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-[var(--border)] text-xs flex items-center justify-between">
              <span className="text-[var(--text-muted)] font-medium">Execution Summary:</span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{successCount} Succeeded</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">{failedCount} Failed / Anomaly</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--border)] apple-glass flex items-center justify-between">
          <button
            onClick={onClose}
            className="h-9 px-4 text-xs font-medium rounded-full text-[var(--text-secondary)] hover:bg-black/[0.04] transition-all cursor-pointer active:scale-95"
          >
            {isProcessing ? "Minimize" : "Close"}
          </button>

          <button
            onClick={handleStartImport}
            disabled={isProcessing || leads.length === 0}
            className="h-9 px-5 rounded-full text-xs font-semibold bg-gradient-to-b from-[#0077ED] to-[#0066CC] hover:from-[#0082FF] hover:to-[#0070E0] text-white shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {isProcessing ? (
              <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SparklesIcon className="w-3.5 h-3.5" />
            )}
            <span>Dispatch Batch ({leads.length} Leads)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
