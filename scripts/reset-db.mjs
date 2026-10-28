import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, "\n") : undefined;

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing required Firebase credentials in environment variables.");
  console.error("Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in .env.local.");
  process.exit(1);
}

const app = getApps().length === 0
  ? initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  : getApps()[0];

const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

async function resetDatabase() {
  console.log("-----------------------------------------");
  console.log("AutoMedic: Resetting Firestore database...");
  console.log("-----------------------------------------");

  // 1. Delete all runs and nested steps
  const runsSnap = await db.collection("runs").get();
  console.log(`Found ${runsSnap.size} workflow runs to clear.`);

  for (const runDoc of runsSnap.docs) {
    const stepsSnap = await runDoc.ref.collection("steps").get();
    if (stepsSnap.size > 0) {
      const stepBatch = db.batch();
      for (const stepDoc of stepsSnap.docs) {
        stepBatch.delete(stepDoc.ref);
      }
      await stepBatch.commit();
    }
    await runDoc.ref.delete();
  }
  console.log("Cleared all runs and nested step logs.");

  // 2. Delete all incidents
  const incidentsSnap = await db.collection("incidents").get();
  console.log(`Found ${incidentsSnap.size} incidents to clear.`);

  if (incidentsSnap.size > 0) {
    // Process in batches of 400 to respect Firestore limits
    const docs = incidentsSnap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + 400);
      for (const doc of chunk) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
  }
  console.log("Cleared all incidents.");

  // 3. Reset config/chaos to { mode: "none" }
  await db.collection("config").doc("chaos").set({
    mode: "none",
    counters: {},
    updatedAt: new Date().toISOString(),
  });
  console.log("Reset config/chaos document to { mode: 'none' }.");

  console.log("-----------------------------------------");
  console.log("Database reset completed successfully!");
  console.log("-----------------------------------------");
}

resetDatabase().catch((err) => {
  console.error("Failed to reset database:", err);
  process.exit(1);
});
