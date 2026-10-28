import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET() {
  try {
    const healthDocRef = adminDb.collection("_health").doc("ping");
    await healthDocRef.set({
      pingAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Service unavailable";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        code: "HEALTH_CHECK_FAILED",
      },
      { status: 500 }
    );
  }
}

