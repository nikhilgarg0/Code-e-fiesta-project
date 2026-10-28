import { NextResponse } from "next/server";
import { getChaos, resetChaosCounters, setDemoState } from "@/lib/firebase/repo";
import { ChaosModeSchema } from "@/lib/types";
import { z } from "zod";

const SetChaosRequestSchema = z.object({
  mode: ChaosModeSchema.or(z.string()),
});

export async function GET(request: Request) {
  // Access request URL to ensure dynamic invocation
  const { searchParams } = new URL(request.url);
  const _ = searchParams.get("t");

  try {
    const chaosConfig = await getChaos();
    return NextResponse.json(chaosConfig);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve chaos configuration";
    return NextResponse.json({ error: message, code: "CHAOS_RETRIEVAL_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = SetChaosRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid chaos configuration payload", code: "INVALID_PAYLOAD", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const updatedConfig = await resetChaosCounters(parsed.data.mode);

    // If reset to none, also clear config/demo idempotently
    if (parsed.data.mode === "none") {
      await setDemoState({
        step: 0,
        totalSteps: 7,
        label: "Demo idle",
        status: "idle",
        actionPrompt: null,
        summary: null,
      });
    }

    return NextResponse.json({
      message: `Chaos mode successfully set to '${parsed.data.mode}' and counters reset.`,
      config: updatedConfig,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to set chaos mode";
    return NextResponse.json({ error: message, code: "CHAOS_UPDATE_FAILED" }, { status: 500 });
  }
}
