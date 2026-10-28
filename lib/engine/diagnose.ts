import { getIncident, updateIncident, getChaos } from "../firebase/repo";
import { generateStructured } from "../ai/gemini";
import { SYSTEM_PROMPT } from "../ai/prompts";
import { getCachedDiagnosis } from "../ai/cache";
import { Diagnosis, DiagnosisSchema, Incident } from "../types";

function truncateString(str: string, maxLength = 4000): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + `... [TRUNCATED - EXCEEDED ${maxLength} CHARS]`;
}

function buildDiagnosticContext(incident: Incident): string {
  const errCtx = incident.errorContext || {};

  const requestStr = errCtx.request ? JSON.stringify(errCtx.request, null, 2) : "N/A";
  const responseStr = errCtx.response ? JSON.stringify(errCtx.response, null, 2) : "N/A";
  const previousOutputsStr = errCtx.previousStepOutputs
    ? JSON.stringify(errCtx.previousStepOutputs, null, 2)
    : "{}";
  const stepConfigStr = errCtx.stepConfig ? JSON.stringify(errCtx.stepConfig, null, 2) : "{}";
  const expectedSchemaStr =
    typeof errCtx.expectedSchema === "object"
      ? JSON.stringify(errCtx.expectedSchema, null, 2)
      : String(errCtx.expectedSchema || "Not specified");

  return `INCIDENT DIAGNOSIS CONTEXT:
- Incident ID: ${incident.id}
- Run ID: ${incident.runId}
- Failed Step: ${incident.failedStep}
- Error Code: ${errCtx.errorCode || "UNKNOWN"}
- Error Message: ${errCtx.errorMessage || "None provided"}

EXPECTED OUTPUT SCHEMA:
${expectedSchemaStr}

REQUEST SENT:
${truncateString(requestStr, 4000)}

RAW RESPONSE / ERROR RECEIVED:
${truncateString(responseStr, 4000)}

CURRENT STEP CONFIG:
${stepConfigStr}

PREVIOUS STEP OUTPUTS:
${truncateString(previousOutputsStr, 4000)}

INSTRUCTIONS:
Diagnose the failure adhering to your system prompt rules.
- Identify failureCategory and quote exact evidence in \`evidence\`.
- Propose the LEAST invasive fix.
- Return structured JSON conforming to DiagnosisSchema.`;
}

async function resolveChaosMode(): Promise<string> {
  try {
    const chaos = await getChaos();
    return chaos?.mode || "schema_drift";
  } catch {
    return "schema_drift";
  }
}

/**
 * Loads an incident from Firestore, constructs the diagnostic prompt,
 * queries Gemini for structured root-cause analysis and proposed fix,
 * persists the diagnosis onto the incident document, and returns it.
 *
 * Demo-proof: If DEMO_FORCE_CACHE=true or if Gemini fails/times out after retry,
 * automatically falls back to pre-written cache with source: "cache".
 */
export async function diagnoseIncident(
  incidentId: string,
  feedback?: string
): Promise<Diagnosis> {
  const incident = await getIncident(incidentId);
  if (!incident) {
    throw new Error(`Incident with id '${incidentId}' not found.`);
  }

  const forceCache = process.env.DEMO_FORCE_CACHE === "true";
  let diagnosis: Diagnosis;

  if (forceCache) {
    console.log(`[AutoMedic Diagnose] DEMO_FORCE_CACHE=true: Bypassing Gemini, loading fallback cache.`);
    const mode = await resolveChaosMode();
    diagnosis = getCachedDiagnosis(mode);
  } else {
    let userPrompt = buildDiagnosticContext(incident);
    if (feedback) {
      userPrompt += `\n\n[FEEDBACK FROM PREVIOUS REJECTED FIX ATTEMPT]:\n${feedback}\nPlease take this into account and propose an alternative valid fix.`;
    }

    try {
      diagnosis = await generateStructured(SYSTEM_PROMPT, userPrompt, DiagnosisSchema);
      diagnosis.source = "gemini";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AutoMedic Diagnose] Gemini diagnosis failed (${msg}). Activating demo fallback cache.`);
      const mode = await resolveChaosMode();
      diagnosis = getCachedDiagnosis(mode);
    }
  }

  // Save diagnosis, proposedFix, and riskLevel onto the incident document.
  // Note: Decision and outcome remain untouched.
  await updateIncident(incidentId, {
    diagnosis,
    proposedFix: diagnosis.proposedFix,
    riskLevel: diagnosis.riskLevel,
  });

  return diagnosis;
}
