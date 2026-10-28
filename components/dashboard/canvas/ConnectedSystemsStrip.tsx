// components/dashboard/canvas/ConnectedSystemsStrip.tsx
"use client";

import React, { useEffect, useState } from "react";
import { ServerIcon } from "../Icons";
import { IntegrationsStatusReport } from "@/lib/integrations/status";

export function ConnectedSystemsStrip() {
  const [status, setStatus] = useState<IntegrationsStatusReport | null>(null);

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => {});
  }, []);

  const enrichmentProvider = status?.enrichment?.provider || "Hunter.io";
  const enrichmentLive = status?.enrichment?.isLive ?? false;

  const crmProvider = status?.crm?.provider || "HubSpot";
  const crmLive = status?.crm?.isLive ?? false;

  const emailProvider = status?.email?.provider || "EmailJS";
  const emailLive = status?.email?.isLive ?? true;

  return (
    <div
      id="connected-systems-strip"
      className="px-5 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xs flex items-center justify-between text-xs font-sans select-none"
    >
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <ServerIcon className="w-3.5 h-3.5" />
          <span>Connected Systems:</span>
        </span>

        {/* Enrichment */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px]">
          <span className={`w-1.5 h-1.5 rounded-full ${enrichmentLive ? "bg-emerald-500" : "bg-zinc-400"}`} />
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Enrichment:</span>
          <span className="text-zinc-500 dark:text-zinc-400">{enrichmentProvider}</span>
          <span className={`text-[10px] uppercase font-mono px-1 py-0.1 rounded ${enrichmentLive ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60" : "text-zinc-500"}`}>
            {enrichmentLive ? "Live" : "Sandbox"}
          </span>
        </div>

        {/* CRM */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px]">
          <span className={`w-1.5 h-1.5 rounded-full ${crmLive ? "bg-emerald-500" : "bg-zinc-400"}`} />
          <span className="font-medium text-zinc-700 dark:text-zinc-300">CRM:</span>
          <span className="text-zinc-500 dark:text-zinc-400">{crmProvider}</span>
          <span className={`text-[10px] uppercase font-mono px-1 py-0.1 rounded ${crmLive ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60" : "text-zinc-500"}`}>
            {crmLive ? "Live" : "Sandbox"}
          </span>
        </div>

        {/* Email */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px]">
          <span className={`w-1.5 h-1.5 rounded-full ${emailLive ? "bg-emerald-500" : "bg-zinc-400"}`} />
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Email:</span>
          <span className="text-zinc-500 dark:text-zinc-400">{emailProvider}</span>
          <span className={`text-[10px] uppercase font-mono px-1 py-0.1 rounded ${emailLive ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60" : "text-zinc-500"}`}>
            {emailLive ? "Live" : "Sandbox"}
          </span>
        </div>
      </div>

      <div className="text-[11px] text-zinc-400 font-mono">
        Webhook: <code className="text-zinc-600 dark:text-zinc-300 font-semibold">/api/webhooks/lead</code>
      </div>
    </div>
  );
}
