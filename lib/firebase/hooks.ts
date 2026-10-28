"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  DocumentData,
  FirestoreError,
} from "firebase/firestore";
import { clientDb } from "./client";
import {
  WorkflowRun,
  StepLog,
  Incident,
  ChaosConfig,
  DemoState,
} from "../types";

/**
 * Safely converts Firestore Timestamp or string/number representation to a Date.
 */
export function toValidDate(val: unknown): Date {
  if (!val) return new Date();
  if (typeof (val as { toDate?: () => Date })?.toDate === "function") {
    return (val as { toDate: () => Date }).toDate();
  }
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Normalizes Firestore document data for WorkflowRun.
 */
function parseWorkflowRun(id: string, data: DocumentData): WorkflowRun {
  return {
    id,
    workflowName: data.workflowName || "lead_to_crm",
    status: data.status || "running",
    inputPayload: (data.inputPayload as Record<string, unknown>) || {},
    currentStep: data.currentStep ?? null,
    stepOutputs: (data.stepOutputs as Record<string, unknown>) || {},
    configPatches: (data.configPatches as Record<string, Record<string, unknown>>) || {},
    incidentCount: typeof data.incidentCount === "number" ? data.incidentCount : 1,
    startedAt: toValidDate(data.startedAt).toISOString(),
    finishedAt: data.finishedAt ? toValidDate(data.finishedAt).toISOString() : null,
  };
}

/**
 * Normalizes Firestore document data for StepLog.
 */
function parseStepLog(id: string, runId: string, data: DocumentData): StepLog {
  return {
    id,
    runId: data.runId || runId,
    stepName: data.stepName || "unknown_step",
    status: data.status || "running",
    request: data.request ?? null,
    response: data.response ?? null,
    errorMessage: data.errorMessage ?? null,
    errorCode: data.errorCode ?? null,
    durationMs: typeof data.durationMs === "number" ? data.durationMs : 0,
    timestamp: toValidDate(data.timestamp).toISOString(),
  };
}

/**
 * Normalizes Firestore document data for Incident.
 */
function parseIncident(id: string, data: DocumentData): Incident {
  return {
    id,
    runId: data.runId || "",
    failedStep: data.failedStep || "",
    errorContext: (data.errorContext as Record<string, unknown>) || {},
    diagnosis: data.diagnosis ?? null,
    proposedFix: data.proposedFix ?? null,
    validationResult: data.validationResult ?? null,
    diagnosisAttempts: Array.isArray(data.diagnosisAttempts) ? data.diagnosisAttempts : undefined,
    riskLevel: data.riskLevel || "medium",
    decision: data.decision || "pending",
    outcome: data.outcome || "pending",
    resolvedBy: data.resolvedBy || undefined,
    detectedAt: data.detectedAt ? toValidDate(data.detectedAt).toISOString() : undefined,
    createdAt: toValidDate(data.createdAt).toISOString(),
    resolvedAt: data.resolvedAt ? toValidDate(data.resolvedAt).toISOString() : null,
  };
}

/**
 * Hook: onSnapshot on the 30 most recent runs, ordered by startedAt desc.
 * If client SDK receives permission-denied, gracefully falls back to polling /api/runs.
 */
export function useRuns() {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    try {
      const q = query(
        collection(clientDb, "runs"),
        orderBy("startedAt", "desc"),
        limit(30)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((docSnap) =>
            parseWorkflowRun(docSnap.id, docSnap.data())
          );
          setRuns(list);
          setLoading(false);
          setPermissionError(false);
        },
        (err) => {
          console.warn("[useRuns] onSnapshot error:", err.code);
          setError(err);
          setLoading(false);
          if (err.code === "permission-denied") {
            setPermissionError(true);
          }
        }
      );
    } catch (err: unknown) {
      console.warn("[useRuns] onSnapshot setup error:", err);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Graceful fallback to server API if client permission is denied
  useEffect(() => {
    if (!permissionError) return;

    let isMounted = true;
    const fetchFallback = async () => {
      try {
        const res = await fetch("/api/runs?limit=30");
        if (res.ok && isMounted) {
          const list = await res.json();
          setRuns(list);
        }
      } catch (e) {
        console.error("[useRuns] Fallback fetch failed:", e);
      }
    };

    fetchFallback();
    const interval = setInterval(fetchFallback, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [permissionError]);

  return { runs, loading, error, permissionError };
}

/**
 * Hook: onSnapshot on a single run doc by id.
 */
export function useRun(runId: string | null) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    let unsubscribe: (() => void) | null = null;

    try {
      const docRef = doc(clientDb, "runs", runId);
      unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setRun(parseWorkflowRun(docSnap.id, docSnap.data()));
          } else {
            setRun(null);
          }
          setLoading(false);
          setPermissionError(false);
        },
        (err) => {
          console.warn(`[useRun:${runId}] onSnapshot error:`, err.code);
          setError(err);
          setLoading(false);
          if (err.code === "permission-denied") {
            setPermissionError(true);
          }
        }
      );
    } catch {
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [runId]);

  // Fallback to server API if permissions denied
  useEffect(() => {
    if (!permissionError || !runId) return;

    let isMounted = true;
    const fetchFallback = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.run) setRun(data.run);
        }
      } catch (e) {
        console.error(`[useRun:${runId}] Fallback fetch failed:`, e);
      }
    };

    fetchFallback();
    const interval = setInterval(fetchFallback, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [permissionError, runId]);

  return { run, loading, error };
}

/**
 * Hook: onSnapshot on runs/{runId}/steps ordered by timestamp.
 */
export function useSteps(runId: string | null) {
  const [steps, setSteps] = useState<StepLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    if (!runId) {
      setSteps([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    let unsubscribe: (() => void) | null = null;

    try {
      const q = query(
        collection(clientDb, "runs", runId, "steps"),
        orderBy("timestamp", "asc")
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((docSnap) =>
            parseStepLog(docSnap.id, runId, docSnap.data())
          );
          setSteps(list);
          setLoading(false);
          setPermissionError(false);
        },
        (err) => {
          console.warn(`[useSteps:${runId}] onSnapshot error:`, err.code);
          setError(err);
          setLoading(false);
          if (err.code === "permission-denied") {
            setPermissionError(true);
          }
        }
      );
    } catch {
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [runId]);

  // Fallback to server API if permissions denied
  useEffect(() => {
    if (!permissionError || !runId) return;

    let isMounted = true;
    const fetchFallback = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data.steps)) setSteps(data.steps);
        }
      } catch (e) {
        console.error(`[useSteps:${runId}] Fallback fetch failed:`, e);
      }
    };

    fetchFallback();
    const interval = setInterval(fetchFallback, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [permissionError, runId]);

  return { steps, loading, error };
}

/**
 * Hook: onSnapshot on incidents where runId == id.
 * In-memory sort by createdAt desc so zero composite indexes are required to run out-of-the-box.
 * Required composite index if extended to Firestore compound query:
 *   Collection: incidents | Fields: runId ASC, createdAt DESC
 */
export function useIncidents(runId: string | null) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    if (!runId) {
      setIncidents([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    let unsubscribe: (() => void) | null = null;

    try {
      const q = query(
        collection(clientDb, "incidents"),
        where("runId", "==", runId)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((docSnap) =>
            parseIncident(docSnap.id, docSnap.data())
          );
          list.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setIncidents(list);
          setLoading(false);
          setPermissionError(false);
        },
        (err) => {
          console.warn(`[useIncidents:${runId}] onSnapshot error:`, err.code);
          setError(err);
          setLoading(false);
          if (err.code === "permission-denied") {
            setPermissionError(true);
          }
        }
      );
    } catch {
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [runId]);

  // Fallback to server API if permissions denied
  useEffect(() => {
    if (!permissionError || !runId) return;

    let isMounted = true;
    const fetchFallback = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.incident) {
            setIncidents([data.incident]);
          } else {
            setIncidents([]);
          }
        }
      } catch (e) {
        console.error(`[useIncidents:${runId}] Fallback fetch failed:`, e);
      }
    };

    fetchFallback();
    const interval = setInterval(fetchFallback, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [permissionError, runId]);

  return { incidents, loading, error };
}

/**
 * Hook: onSnapshot on recent incidents for calculating top-bar telemetry KPIs.
 */
export function useAllIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    try {
      const q = query(
        collection(clientDb, "incidents"),
        orderBy("createdAt", "desc"),
        limit(50)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((docSnap) =>
            parseIncident(docSnap.id, docSnap.data())
          );
          setIncidents(list);
          setLoading(false);
        },
        (err) => {
          console.warn("[useAllIncidents] onSnapshot error:", err.code);
          setError(err);
          setLoading(false);
        }
      );
    } catch {
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { incidents, loading, error };
}

/**
 * Hook: onSnapshot on config/chaos for real-time mode tracking.
 */
export function useChaos() {
  const [chaos, setChaos] = useState<ChaosConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    try {
      const docRef = doc(clientDb, "config", "chaos");

      unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setChaos(docSnap.data() as ChaosConfig);
          } else {
            setChaos({ mode: "none", counters: {} });
          }
          setLoading(false);
          setPermissionError(false);
        },
        (err) => {
          console.warn("[useChaos] onSnapshot error:", err.code);
          setError(err);
          setLoading(false);
          if (err.code === "permission-denied") {
            setPermissionError(true);
          }
        }
      );
    } catch {
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fallback to /api/chaos if permission denied
  useEffect(() => {
    if (!permissionError) return;

    let isMounted = true;
    const fetchFallback = async () => {
      try {
        const res = await fetch("/api/chaos");
        if (res.ok && isMounted) {
          const data = await res.json();
          setChaos(data);
        }
      } catch (e) {
        console.error("[useChaos] Fallback fetch failed:", e);
      }
    };

    fetchFallback();
    const interval = setInterval(fetchFallback, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [permissionError]);

  return { chaos, loading, error };
}

/**
 * Hook: onSnapshot on config/demo for scripted demo sequence tracking.
 */
export function useDemo() {
  const [demo, setDemo] = useState<DemoState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    try {
      const docRef = doc(clientDb, "config", "demo");

      unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setDemo(docSnap.data() as DemoState);
          } else {
            setDemo({
              step: 0,
              totalSteps: 7,
              label: "Idle",
              status: "idle",
              actionPrompt: null,
            });
          }
          setLoading(false);
          setPermissionError(false);
        },
        (err) => {
          console.warn("[useDemo] onSnapshot error:", err.code);
          setError(err);
          setLoading(false);
          if (err.code === "permission-denied") {
            setPermissionError(true);
          }
        }
      );
    } catch {
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fallback to /api/demo if permission denied
  useEffect(() => {
    if (!permissionError) return;

    let isMounted = true;
    const fetchFallback = async () => {
      try {
        const res = await fetch("/api/demo");
        if (res.ok && isMounted) {
          const data = await res.json();
          setDemo(data);
        }
      } catch (e) {
        console.error("[useDemo] Fallback fetch failed:", e);
      }
    };

    fetchFallback();
    const interval = setInterval(fetchFallback, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [permissionError]);

  return { demo, loading, error };
}

/**
 * Hook: Monitors browser network status and Firestore client reachability.
 */
export function useFirestoreConnectivity() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

