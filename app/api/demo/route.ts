import { NextResponse } from "next/server";
import { getDemoState } from "@/lib/firebase/repo";

export async function GET() {
  try {
    const state = await getDemoState();
    return NextResponse.json(
      state || {
        step: 0,
        totalSteps: 7,
        label: "Idle",
        status: "idle",
        actionPrompt: null,
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch demo state";
    return NextResponse.json({ error: message, code: "DEMO_FETCH_ERROR" }, { status: 500 });
  }
}
