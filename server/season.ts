import { and, eq, gte, lt } from "drizzle-orm";
import { gameMatchResults, gameMatches, users } from "../drizzle/schema";
import { getDb } from "./db";

const ROME_TIMEZONE = "Europe/Rome";
export const MINIMUM_VALID_MATCHES = 5;

export function seasonWindow(now = new Date()) {
  const seasonYear = Number(new Intl.DateTimeFormat("en-GB", { timeZone: ROME_TIMEZONE, year: "numeric" }).format(now));
  // Il 31 dicembre a mezzanotte a Roma cade alle 23:00 UTC del 30 dicembre (CET).
  return {
    seasonYear,
    start: new Date(Date.UTC(seasonYear - 1, 11, 30, 23, 0, 0)),
    end: new Date(Date.UTC(seasonYear, 11, 30, 23, 0, 0)),
  };
}

export function leaderboardStatus(resultCount: number) {
  return resultCount >= MINIMUM_VALID_MATCHES ? "valid" : "provisional";
}

export type SeasonResultRecord = {
  userId: number;
  name: string | null;
  finalScore: number;
  status: "playing" | "finished" | "abandoned";
  finishedAt: Date | null;
};

export function aggregateSeasonResults(rows: SeasonResultRecord[], now = new Date()) {
  const season = seasonWindow(now);
  const grouped = new Map<number, { name: string; scores: number[] }>();
  for (const row of rows) {
    if (row.status !== "finished" || !row.finishedAt || row.finishedAt < season.start || row.finishedAt >= season.end) continue;
    const entry = grouped.get(row.userId) ?? { name: row.name?.trim() || "Giocatore", scores: [] };
    entry.scores.push(row.finalScore);
    grouped.set(row.userId, entry);
  }
  const ordered = Array.from(grouped.entries()).map(([userId, entry]) => ({
    userId,
    name: entry.name,
    resultCount: entry.scores.length,
    averageScore: Number((entry.scores.reduce((sum: number, score: number) => sum + score, 0) / entry.scores.length).toFixed(2)),
  })).sort((a, b) => a.averageScore - b.averageScore || a.name.localeCompare(b.name));
  let validPlace = 0;
  return {
    seasonYear: season.seasonYear,
    closesAt: season.end,
    entries: ordered.map((entry) => {
      const status = leaderboardStatus(entry.resultCount);
      if (status === "valid") validPlace += 1;
      return { ...entry, status, place: status === "valid" ? validPlace : null };
    }),
  };
}

export async function getSeasonLeaderboard(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("La classifica non è disponibile.");
  const rows = await db.select({
    userId: users.id,
    name: users.name,
    finalScore: gameMatchResults.finalScore,
    status: gameMatches.status,
    finishedAt: gameMatches.finishedAt,
  })
    .from(gameMatchResults)
    .innerJoin(gameMatches, eq(gameMatchResults.matchId, gameMatches.id))
    .innerJoin(users, eq(gameMatchResults.userId, users.id))
    .where(and(gte(gameMatches.finishedAt, seasonWindow(now).start), lt(gameMatches.finishedAt, seasonWindow(now).end)));
  return aggregateSeasonResults(rows, now);
}
