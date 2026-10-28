import { getApps, initializeApp, cert, getApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App;

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, "\n") : undefined;

  if (projectId && clientEmail && privateKey) {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    // Graceful fallback for build-time static analysis and unconfigured local environments
    app = initializeApp({
      projectId: projectId || "automedic-dev",
    });
  }
} else {
  app = getApp();
}

let adminDb: Firestore;
try {
  adminDb = getFirestore(app);
  adminDb.settings({ ignoreUndefinedProperties: true });
} catch {
  adminDb = getFirestore(app);
}

export { adminDb, app as adminApp };
