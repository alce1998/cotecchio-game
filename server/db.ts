import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

const inMemoryUsers = new Map<string, any>();
let nextUserId = 1;

import { getUserFromFirestore, saveUserToFirestore } from "./firestore";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  // Save to Firestore asynchronously for permanent persistence across restarts
  saveUserToFirestore(user).catch(() => undefined);

  const db = await getDb();
  if (!db) {
    let existing = inMemoryUsers.get(user.openId);
    const now = new Date();
    if (!existing) {
      existing = {
        id: nextUserId++,
        openId: user.openId,
        name: user.name ?? "Giocatore",
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? "quick",
        role: user.openId === ENV.ownerOpenId ? "admin" : "user",
        avatarUrl: null,
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      };
    } else {
      if (user.name !== undefined) existing.name = user.name;
      if (user.email !== undefined) existing.email = user.email;
      if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod;
      existing.lastSignedIn = user.lastSignedIn ?? now;
      existing.updatedAt = now;
    }
    inMemoryUsers.set(user.openId, existing);
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    let local = inMemoryUsers.get(openId);
    if (!local) {
      const fsUser = await getUserFromFirestore(openId);
      if (fsUser) {
        inMemoryUsers.set(openId, fsUser);
        return fsUser;
      }
    }
    return local;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
