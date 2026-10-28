// components/dashboard/CsvImportModal.tsx
"use client";

import React, { useState } from "react";
import {
  XCircleIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  SparklesIcon,
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
  onErrorToast,
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <SparklesIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-mono font-bold text-white">
                Batch Lead Ingestion (CSV)
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Upload up to 50 real/messy leads with concurrency throttling
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 p-1 rounded-lg transition-colors"
          >
            <XCircleIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Action Row: Load Preset or File Upload */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <button
              onClick={handleLoadSample}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 transition-colors flex items-center gap-1.5"
            >
              <span>⚡ Load Sample Messy Leads (8 rows)</span>
            </button>

            <label className="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 cursor-pointer transition-colors">
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

          {/* Raw Text View / Preview */}
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
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Parsed Leads Table Preview */}
          {leads.length > 0 && (
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
              <div className="px-3 py-2 bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                <span>Leads Queue ({leads.length} rows)</span>
                <span>
                  Completed: {processedCount} / {leads.length}
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-zinc-900 font-mono text-xs">
                {leads.map((l) => (
                  <div key={l.id} className="p-2.5 flex items-center justify-between gap-3 text-zinc-300">
                    <div className="truncate flex-1">
                      <span className="font-semibold text-white">{l.name || "(missing name)"}</span>
                      <span className="text-zinc-500 ml-2">({l.company || "no company"})</span>
                      <div className="text-[11px] text-zinc-500 truncate">{l.email || "no email"}</div>
                    </div>

                    <div className="text-[11px]">
                      {l.status === "pending" && (
                        <span className="text-zinc-500">pending</span>
                      )}
                      {l.status === "processing" && (
                        <span className="text-blue-400 flex items-center gap-1">
                          <RefreshCwIcon className="w-3 h-3 animate-spin" /> running
                        </span>
                      )}
                      {l.status === "success" && (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircleIcon className="w-3.5 h-3.5" /> #{l.runId?.slice(0, 6)}
                        </span>
                      )}
                      {l.status === "failed" && (
                        <span className="text-rose-400 flex items-center gap-1 font-semibold" title={l.error}>
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
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs font-mono flex items-center justify-between">
              <span className="text-zinc-400">Execution Summary:</span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold">{successCount} Succeeded</span>
                <span className="text-rose-400 font-bold">{failedCount} Failed / Anomaly</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-white transition-colors"
          >
            {isProcessing ? "Minimize" : "Close"}
          </button>

          <button
            onClick={handleStartImport}
            disabled={isProcessing || leads.length === 0}
            className="px-5 py-2 rounded-lg text-xs font-mono font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-400/40 transition-all flex items-center gap-2 disabled:opacity-50"
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
