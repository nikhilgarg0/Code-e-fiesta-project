import { NextResponse } from "next/server";
import { resetChaosCounters, setDemoState, setChaos, clearAllRunsAndIncidents } from "@/lib/firebase/repo";

export async function POST() {
  try {
    const resetTime = new Date().toISOString();

    await Promise.all([
      clearAllRunsAndIncidents(),
      setChaos({ mode: "none", counters: {}, resetAt: resetTime }),
      resetChaosCounters("none", resetTime),
      setDemoState({
        step: 0,
        totalSteps: 7,
        label: "Demo idle",
        status: "idle",
        actionPrompt: null,
        summary: null,
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Reset completed successfully: old runs and incidents deleted, chaos cleared, and demo reset to idle.",
      resetAt: resetTime,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Reset failed";
    return NextResponse.json(
      { error: message, code: "RESET_FAILED" },
      { status: 500 }
    );
  }
}
