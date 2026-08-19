import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { aggregateSeasonResults, SeasonResultRecord } from "./season";

let isFirestoreAvailable = false;
let db: ReturnType<typeof getFirestore> | null = null;

try {
  if (!getApps().length) {
    initializeApp();
  }
  db = getFirestore();
  isFirestoreAvailable = true;
  console.log("[Firestore] Successfully initialized Firebase Admin Firestore.");
} catch (err) {
  console.warn("[Firestore] Initialization skipped or failed:", err);
  db = null;
  isFirestoreAvailable = false;
}

export function getFirestoreDb() {
  return isFirestoreAvailable ? db : null;
}

// =============================================================================
// User Persistence
// =============================================================================

export async function saveUserToFirestore(user: {
  openId: string;
  name: string | null;
  email?: string | null;
  loginMethod?: string | null;
  avatarUrl?: string | null;
  lastSignedIn?: Date;
}) {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const ref = fdb.collection("users").doc(user.openId);
    const snap = await ref.get();
    const now = new Date().toISOString();
    if (!snap.exists) {
      await ref.set({
        openId: user.openId,
        name: user.name ?? "Giocatore",
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? "quick",
        avatarUrl: user.avatarUrl ?? null,
        createdAt: now,
        updatedAt: now,
        lastSignedIn: user.lastSignedIn ? user.lastSignedIn.toISOString() : now,
      });
    } else {
      const updateData: Record<string, any> = { updatedAt: now };
      if (user.name !== undefined) updateData.name = user.name;
      if (user.email !== undefined) updateData.email = user.email;
      if (user.loginMethod !== undefined) updateData.loginMethod = user.loginMethod;
      if (user.avatarUrl !== undefined) updateData.avatarUrl = user.avatarUrl;
      if (user.lastSignedIn) updateData.lastSignedIn = user.lastSignedIn.toISOString();
      await ref.update(updateData);
    }
  } catch (err) {
    console.warn("[Firestore] saveUserToFirestore failed:", err);
  }
}

export async function getUserFromFirestore(openId: string) {
  const fdb = getFirestoreDb();
  if (!fdb) return null;
  try {
    const snap = await fdb.collection("users").doc(openId).get();
    if (!snap.exists) return null;
    const data = snap.data();
    return {
      id: Math.abs(hashCode(openId)),
      openId: data?.openId || openId,
      name: data?.name || "Giocatore",
      email: data?.email || null,
      loginMethod: data?.loginMethod || "quick",
      avatarUrl: data?.avatarUrl || null,
      createdAt: data?.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data?.updatedAt ? new Date(data.updatedAt) : new Date(),
      lastSignedIn: data?.lastSignedIn ? new Date(data.lastSignedIn) : new Date(),
    };
  } catch (err) {
    console.warn("[Firestore] getUserFromFirestore failed:", err);
    return null;
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

// =============================================================================
// Match & Season Results Persistence
// =============================================================================

export async function recordMatchToFirestore(record: {
  matchId: string;
  userId: number;
  openId?: string;
  name: string | null;
  finalScore: number;
  placement: number;
}) {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docId = `${record.matchId}_${record.userId}`;
    const ref = fdb.collection("match_results").doc(docId);
    const now = new Date().toISOString();
    await ref.set({
      matchId: record.matchId,
      userId: record.userId,
      openId: record.openId || null,
      name: record.name || "Giocatore",
      finalScore: record.finalScore,
      placement: record.placement,
      status: "finished",
      finishedAt: now,
    });
    console.log(`[Firestore] Recorded match result for ${record.name} (${record.finalScore} pt)`);
  } catch (err) {
    console.warn("[Firestore] recordMatchToFirestore failed:", err);
  }
}

export async function getSeasonLeaderboardFromFirestore(now = new Date()) {
  const fdb = getFirestoreDb();
  if (!fdb) return null;
  try {
    const snap = await fdb.collection("match_results").get();
    if (snap.empty) return null;
    const records: SeasonResultRecord[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        userId: d.userId,
        name: d.name ?? "Giocatore",
        finalScore: Number(d.finalScore),
        status: "finished" as const,
        finishedAt: d.finishedAt ? new Date(d.finishedAt) : new Date(),
      };
    });
    return aggregateSeasonResults(records, now);
  } catch (err) {
    console.warn("[Firestore] getSeasonLeaderboardFromFirestore failed:", err);
    return null;
  }
}
