import { z } from "zod";

// ==========================================
// Enum Schemas & Types
// ==========================================

export const FixTypeSchema = z.enum([
  "remap_field",
  "retry_with_backoff",
  "switch_to_fallback_endpoint",
  "coerce_type",
  "skip_step",
]);
export type FixType = z.infer<typeof FixTypeSchema>;

export const WorkflowRunStatusSchema = z.enum([
  "running",
  "success",
  "failed",
  "healing",
  "awaiting_approval",
  "healed",
]);
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusSchema>;

export const StepLogStatusSchema = z.enum([
  "running",
  "success",
  "failed",
  "skipped",
]);
export type StepLogStatus = z.infer<typeof StepLogStatusSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const IncidentDecisionSchema = z.enum([
  "auto_applied",
  "approved",
  "rejected",
  "rejected_by_validator",
  "pending",
]);
export type IncidentDecision = z.infer<typeof IncidentDecisionSchema>;

export const IncidentOutcomeSchema = z.enum([
  "recovered",
  "failed",
  "pending",
]);
export type IncidentOutcome = z.infer<typeof IncidentOutcomeSchema>;

// ==========================================
// AI Diagnosis & Healing Schemas
// ==========================================

export const FailureCategorySchema = z.enum([
  "schema_drift",
  "transient",
  "rate_limit",
  "bad_data",
  "outage",
  "unknown",
]);
export type FailureCategory = z.infer<typeof FailureCategorySchema>;

export const ProposedFixSchema = z.object({
  type: FixTypeSchema,
  params: z.record(z.string(), z.unknown()).default({}),
  explanation: z.string(),
});
export type ProposedFix = z.infer<typeof ProposedFixSchema>;

export const DiagnosisSchema = z.object({
  rootCause: z.string(),
  failureCategory: FailureCategorySchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  proposedFix: ProposedFixSchema,
  riskLevel: RiskLevelSchema,
  alternativesConsidered: z.array(z.string()),
  source: z.enum(["gemini", "cache"]).default("gemini").optional(),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

export const DemoStatusSchema = z.enum(["idle", "running", "paused", "completed", "error"]);
export type DemoStatus = z.infer<typeof DemoStatusSchema>;

export const DemoSummarySchema = z.object({
  runs: z.number().optional(),
  autoHealed: z.number().optional(),
  humanApproved: z.number().optional(),
  rejectedByValidator: z.number().optional(),
  meanTimeToRecovery: z.string().optional(),
});
export type DemoSummary = z.infer<typeof DemoSummarySchema>;

export const DemoStateSchema = z.object({
  step: z.number(),
  totalSteps: z.number(),
  label: z.string(),
  status: DemoStatusSchema,
  actionPrompt: z.string().nullable().optional(),
  runId: z.string().nullable().optional(),
  summary: DemoSummarySchema.nullable().optional(),
  updatedAt: z.string().optional(),
});
export type DemoState = z.infer<typeof DemoStateSchema>;

export const ValidationCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  detail: z.string(),
});
export type ValidationCheck = z.infer<typeof ValidationCheckSchema>;

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  requiresApproval: z.boolean(),
  checks: z.array(ValidationCheckSchema),
  validatedAt: z.string(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// ==========================================
// Domain Schemas & Types
// ==========================================

export const WorkflowRunSchema = z.object({
  id: z.string(),
  workflowName: z.string(),
  status: WorkflowRunStatusSchema,
  inputPayload: z.record(z.string(), z.unknown()),
  currentStep: z.string().nullable().optional(),
  stepOutputs: z.record(z.string(), z.unknown()).default({}).optional(),
  configPatches: z.record(z.string(), z.record(z.string(), z.unknown())).default({}).optional(),
  incidentCount: z.number().default(1).optional(),
  startedAt: z.string(),
  finishedAt: z.string().nullable().optional(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

export const StepLogSchema = z.object({
  id: z.string(),
  runId: z.string(),
  stepName: z.string(),
  status: StepLogStatusSchema,
  request: z.unknown().nullable().optional(),
  response: z.unknown().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  errorCode: z.union([z.string(), z.number()]).nullable().optional(),
  durationMs: z.number(),
  timestamp: z.string(),
});
export type StepLog = z.infer<typeof StepLogSchema>;

export const DiagnosisAttemptSchema = z.object({
  attempt: z.number(),
  diagnosis: DiagnosisSchema,
  validationResult: ValidationResultSchema,
});
export type DiagnosisAttempt = z.infer<typeof DiagnosisAttemptSchema>;

export const IncidentSchema = z.object({
  id: z.string(),
  runId: z.string(),
  failedStep: z.string(),
  errorContext: z.record(z.string(), z.unknown()),
  diagnosis: DiagnosisSchema.nullable().optional(),
  proposedFix: ProposedFixSchema.nullable().optional(),
  validationResult: ValidationResultSchema.nullable().optional(),
  diagnosisAttempts: z.array(DiagnosisAttemptSchema).optional(),
  riskLevel: RiskLevelSchema,
  decision: IncidentDecisionSchema,
  outcome: IncidentOutcomeSchema,
  resolvedBy: z.enum(["auto", "human"]).nullable().optional(),
  detectedAt: z.string().optional(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable().optional(),
});
export type Incident = z.infer<typeof IncidentSchema>;

// ==========================================
// Chaos Configuration Schema
// ==========================================

export const ChaosModeSchema = z.enum([
  "none",
  "schema_drift",
  "transient_500",
  "rate_limit",
  "bad_type",
  "primary_down",
  "bad_fix_trap",
]);
export type ChaosMode = z.infer<typeof ChaosModeSchema>;

export const ChaosConfigSchema = z.object({
  mode: ChaosModeSchema.or(z.string()),
  counters: z.record(z.string(), z.number()).default({}),
  resetAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type ChaosConfig = z.infer<typeof ChaosConfigSchema>;
