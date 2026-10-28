import { adminDb } from "./admin";
import {
  WorkflowRun,
  WorkflowRunSchema,
  StepLog,
  StepLogSchema,
  Incident,
  IncidentSchema,
  ChaosConfig,
  ChaosConfigSchema,
  DemoState,
  DemoStateSchema,
} from "../types";

/**
 * Recursively converts Firestore Timestamp instances (or objects with a toDate method)
 * into ISO 8601 strings at the repository boundary.
 */
function sanitizeFirestoreData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  // Firestore Timestamp duck-typing check
  if (
    typeof input === "object" &&
    input !== null &&
    "toDate" in input &&
    typeof (input as unknown as { toDate: unknown }).toDate === "function"
  ) {
    return (input as unknown as { toDate: () => Date }).toDate().toISOString() as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }

  if (typeof input === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      copy[key] = sanitizeFirestoreData(value);
    }
    return copy as T;
  }

  return input;
}

// ==========================================
// Workflow Runs (runs/{runId})
// ==========================================

export async function createRun(
  runData: Omit<WorkflowRun, "id"> & { id?: string }
): Promise<WorkflowRun> {
  const collectionRef = adminDb.collection("runs");
  const docRef = runData.id ? collectionRef.doc(runData.id) : collectionRef.doc();
  const id = docRef.id;

  const payload: WorkflowRun = {
    ...runData,
    id,
    startedAt: runData.startedAt || new Date().toISOString(),
    finishedAt: runData.finishedAt ?? null,
    currentStep: runData.currentStep ?? null,
    stepOutputs: runData.stepOutputs ?? {},
  };

  const parsed = WorkflowRunSchema.parse(payload);
  await docRef.set(parsed);
  return parsed;
}

export async function updateRun(
  runId: string,
  updates: Partial<Omit<WorkflowRun, "id">>
): Promise<void> {
  const docRef = adminDb.collection("runs").doc(runId);
  await docRef.update(updates);
}

export async function getRun(runId: string): Promise<WorkflowRun | null> {
  const docSnap = await adminDb.collection("runs").doc(runId).get();
  if (!docSnap.exists) {
    return null;
  }
  const rawData = sanitizeFirestoreData(docSnap.data());
  return WorkflowRunSchema.parse({ ...rawData, id: docSnap.id });
}

export async function getRecentRuns(limitCount = 20): Promise<WorkflowRun[]> {
  const snap = await adminDb
    .collection("runs")
    .orderBy("startedAt", "desc")
    .limit(limitCount)
    .get();

  return snap.docs.map((doc) => {
    const rawData = sanitizeFirestoreData(doc.data());
    return WorkflowRunSchema.parse({ ...rawData, id: doc.id });
  });
}

// ==========================================
// Step Logs (runs/{runId}/steps/{stepId})
// ==========================================

export async function addStepLog(
  runId: string,
  stepData: Omit<StepLog, "id" | "runId"> & { id?: string }
): Promise<StepLog> {
  const stepsCollection = adminDb.collection("runs").doc(runId).collection("steps");
  const docRef = stepData.id ? stepsCollection.doc(stepData.id) : stepsCollection.doc();
  const id = docRef.id;

  const payload: StepLog = {
    ...stepData,
    id,
    runId,
    timestamp: stepData.timestamp || new Date().toISOString(),
    request: stepData.request ?? null,
    response: stepData.response ?? null,
    errorMessage: stepData.errorMessage ?? null,
    errorCode: stepData.errorCode ?? null,
  };

  const parsed = StepLogSchema.parse(payload);
  await docRef.set(parsed);
  return parsed;
}

export async function getStepLogs(runId: string): Promise<StepLog[]> {
  const stepsSnap = await adminDb
    .collection("runs")
    .doc(runId)
    .collection("steps")
    .orderBy("timestamp", "asc")
    .get();

  return stepsSnap.docs.map((doc) => {
    const rawData = sanitizeFirestoreData(doc.data());
    return StepLogSchema.parse({ ...rawData, id: doc.id, runId });
  });
}

// ==========================================
// Incidents (incidents/{incidentId})
// ==========================================

export async function createIncident(
  incidentData: Omit<Incident, "id"> & { id?: string }
): Promise<Incident> {
  const collectionRef = adminDb.collection("incidents");
  const docRef = incidentData.id ? collectionRef.doc(incidentData.id) : collectionRef.doc();
  const id = docRef.id;

  const payload: Incident = {
    ...incidentData,
    id,
    createdAt: incidentData.createdAt || new Date().toISOString(),
    resolvedAt: incidentData.resolvedAt ?? null,
    diagnosis: incidentData.diagnosis ?? null,
    proposedFix: incidentData.proposedFix ?? null,
    validationResult: incidentData.validationResult ?? null,
  };

  const parsed = IncidentSchema.parse(payload);
  await docRef.set(parsed);
  return parsed;
}

export async function updateIncident(
  incidentId: string,
  updates: Partial<Omit<Incident, "id">>
): Promise<void> {
  const docRef = adminDb.collection("incidents").doc(incidentId);
  await docRef.update(updates);
}

export async function getIncident(incidentId: string): Promise<Incident | null> {
  const docSnap = await adminDb.collection("incidents").doc(incidentId).get();
  if (!docSnap.exists) {
    return null;
  }
  const rawData = sanitizeFirestoreData(docSnap.data());
  return IncidentSchema.parse({ ...rawData, id: docSnap.id });
}

export async function getIncidentForRun(runId: string): Promise<Incident | null> {
  const snap = await adminDb
    .collection("incidents")
    .where("runId", "==", runId)
    .get();

  if (snap.empty) {
    return null;
  }

  // In-memory sort by createdAt descending to always retrieve the latest incident
  const sortedDocs = [...snap.docs].sort((a, b) => {
    const timeA = new Date(a.data().createdAt || 0).getTime();
    const timeB = new Date(b.data().createdAt || 0).getTime();
    return timeB - timeA;
  });

  const doc = sortedDocs[0];
  const rawData = sanitizeFirestoreData(doc.data());
  return IncidentSchema.parse({ ...rawData, id: doc.id });
}

// ==========================================
// Chaos Configuration (config/chaos)
// ==========================================

const DEFAULT_CHAOS_CONFIG: ChaosConfig = {
  mode: "none",
  counters: {},
  updatedAt: new Date().toISOString(),
};

export async function getChaos(): Promise<ChaosConfig> {
  const docRef = adminDb.collection("config").doc("chaos");
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    await docRef.set(DEFAULT_CHAOS_CONFIG);
    return DEFAULT_CHAOS_CONFIG;
  }

  const rawData = sanitizeFirestoreData(docSnap.data());
  return ChaosConfigSchema.parse(rawData);
}

export async function setChaos(chaos: Partial<ChaosConfig>): Promise<void> {
  const docRef = adminDb.collection("config").doc("chaos");
  const payload = {
    ...chaos,
    updatedAt: new Date().toISOString(),
  };
  await docRef.set(payload, { merge: true });
}

export async function incrementChaosCounter(key: string): Promise<number> {
  const docRef = adminDb.collection("config").doc("chaos");
  return await adminDb.runTransaction(async (t) => {
    const docSnap = await t.get(docRef);
    let currentCounters: Record<string, number> = {};
    let mode = "none";

    if (docSnap.exists) {
      const data = docSnap.data();
      currentCounters = { ...(data?.counters || {}) };
      mode = data?.mode || "none";
    }

    const newCount = (currentCounters[key] || 0) + 1;
    currentCounters[key] = newCount;

    t.set(
      docRef,
      {
        mode,
        counters: currentCounters,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return newCount;
  });
}

export async function resetChaosCounters(mode?: string, resetAt?: string): Promise<ChaosConfig> {
  const docRef = adminDb.collection("config").doc("chaos");
  const docSnap = await docRef.get();
  const existingData = docSnap.exists ? docSnap.data() : null;
  const currentMode = mode || existingData?.mode || "none";

  const updatedConfig: ChaosConfig = {
    mode: currentMode,
    counters: {},
    resetAt: resetAt || existingData?.resetAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await docRef.set(updatedConfig);
  return updatedConfig;
}

/**
 * Purges all past workflow runs (including subcollection steps) and incidents
 * so that stale runs never pile up across demo sessions.
 */
export async function clearAllRunsAndIncidents(): Promise<void> {
  // 1. Delete all incidents in batches
  const incidentsSnap = await adminDb.collection("incidents").get();
  if (!incidentsSnap.empty) {
    const batch = adminDb.batch();
    incidentsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  // 2. Delete all runs and subcollection steps in parallel
  const runsSnap = await adminDb.collection("runs").get();
  if (!runsSnap.empty) {
    await Promise.all(
      runsSnap.docs.map(async (runDoc) => {
        const stepsSnap = await runDoc.ref.collection("steps").get();
        if (!stepsSnap.empty) {
          const stepBatch = adminDb.batch();
          stepsSnap.docs.forEach((s) => stepBatch.delete(s.ref));
          await stepBatch.commit();
        }
        await runDoc.ref.delete();
      })
    );
  }
}

// ==========================================
// Demo State (config/demo)
// ==========================================

export async function getDemoState(): Promise<DemoState | null> {
  const docSnap = await adminDb.collection("config").doc("demo").get();
  if (!docSnap.exists) {
    return null;
  }
  const rawData = sanitizeFirestoreData(docSnap.data());
  return DemoStateSchema.parse(rawData);
}

export async function setDemoState(updates: Partial<DemoState>): Promise<void> {
  const docRef = adminDb.collection("config").doc("demo");
  const payload = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await docRef.set(payload, { merge: true });
}

