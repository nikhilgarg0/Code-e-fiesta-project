// components/dashboard/RunDetail.tsx
"use client";

import React from "react";
import { WorkflowRun, StepLog, Incident } from "@/lib/types";
import { WorkflowCanvas } from "./canvas/WorkflowCanvas";

interface RunDetailProps {
  run: WorkflowRun | null;
  steps: StepLog[];
  incident: Incident | null;
  loading?: boolean;
  onApproveFix?: (incidentId: string) => Promise<void>;
  onRejectFix?: (incidentId: string) => Promise<void>;
  onOpenTestLab?: () => void;
  onOpenSubmitLead?: () => void;
}

export function RunDetail({
  run,
  steps,
  incident,
  loading,
  onApproveFix,
  onRejectFix,
  onOpenTestLab,
  onOpenSubmitLead,
}: RunDetailProps) {
  return (
    <WorkflowCanvas
      run={run}
      steps={steps}
      incident={incident}
      loading={loading}
      onApproveFix={onApproveFix}
      onRejectFix={onRejectFix}
      onOpenTestLab={onOpenTestLab}
      onOpenSubmitLead={onOpenSubmitLead}
    />
  );
}
